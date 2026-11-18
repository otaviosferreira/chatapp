"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

type Conversation = Tables<"conversations">;
type Message = Tables<"messages">;
type DirectoryProfile = Pick<Tables<"profiles">, "id" | "full_name">;

type ChatWorkspaceProps = {
  userId: string;
  userName: string;
};

export function ChatWorkspace({ userId, userName }: ChatWorkspaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [newParticipantId, setNewParticipantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setErrorMessage(null);

      const [membershipsResult, directoryResult] = await Promise.all([
        supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("profile_id", userId)
          .is("left_at", null),
        supabase
          .from("profiles")
          .select("id,full_name")
          .neq("id", userId)
          .order("full_name", { ascending: true })
      ]);

      if (!active) return;

      if (membershipsResult.error || directoryResult.error) {
        setErrorMessage("Não foi possível carregar as conversas ou o diretório de funcionários.");
        setLoading(false);
        return;
      }

      const conversationIds = [...new Set(membershipsResult.data.map((item) => item.conversation_id))];
      const conversationsResult = conversationIds.length
        ? await supabase
            .from("conversations")
            .select("id,type,title,created_by,direct_key,created_at,archived_at")
            .in("id", conversationIds)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
        : { data: [] as Conversation[], error: null };

      if (!active) return;

      if (conversationsResult.error) {
        setErrorMessage("Não foi possível carregar a lista de conversas.");
      } else {
        const nextConversations = conversationsResult.data ?? [];
        setConversations(nextConversations);
        setSelectedConversationId((current) =>
          current && nextConversations.some((item) => item.id === current)
            ? current
            : nextConversations[0]?.id ?? null
        );
      }

      setDirectory(directoryResult.data ?? []);
      setLoading(false);
    }

    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  useEffect(() => {
    const conversationId = selectedConversationId;
    if (!conversationId) return;

    let active = true;
    const channel = supabase
      .channel(`conversation-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) =>
            current.some((item) => item.id === incoming.id)
              ? current
              : [...current, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at))
          );
        }
      )
      .subscribe((status) => {
        if (active) setRealtimeStatus(status.toLowerCase());
      });

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,client_message_id,body,reply_to_id,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (!active) return;
      if (error) {
        setErrorMessage("Não foi possível carregar o histórico desta conversa.");
        return;
      }
      setMessages(data ?? []);
    }

    void loadMessages();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, selectedConversationId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedConversationId || sending) return;

    setSending(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedConversationId,
        sender_id: userId,
        client_message_id: crypto.randomUUID(),
        body
      })
      .select("id,conversation_id,sender_id,client_message_id,body,reply_to_id,created_at")
      .single();

    if (error) {
      setErrorMessage("A mensagem não foi enviada. Verifique sua participação na conversa e tente novamente.");
    } else {
      setMessages((current) =>
        current.some((item) => item.id === data.id) ? current : [...current, data]
      );
      setDraft("");
    }

    setSending(false);
  }

  async function createDirectConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newParticipantId || creating) return;

    setCreating(true);
    setErrorMessage(null);

    const { data, error } = await supabase.rpc("create_conversation", {
      _type: "direct",
      _member_ids: [newParticipantId]
    });

    if (error || !data) {
      setErrorMessage("Não foi possível criar a conversa. Confirme se a conta selecionada está ativa.");
      setCreating(false);
      return;
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("conversations")
      .select("id,type,title,created_by,direct_key,created_at,archived_at")
      .eq("id", data)
      .single();

    if (!refreshError && refreshed) {
      setConversations((current) =>
        [refreshed, ...current.filter((item) => item.id !== refreshed.id)]
      );
      setSelectedConversationId(refreshed.id);
      setNewParticipantId("");
    } else {
      setErrorMessage("Conversa criada, mas não foi possível atualizar a lista. Atualize a página.");
    }

    setCreating(false);
  }

  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);

  return (
    <section className="mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-h-[280px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
          <p className="mt-1 text-xs text-slate-500">Somente conversas privadas das quais você participa.</p>
        </div>

        <form onSubmit={createDirectConversation} className="mb-4 space-y-2">
          <label className="block text-xs font-medium text-slate-600" htmlFor="new-participant">
            Iniciar conversa individual
          </label>
          <select
            id="new-participant"
            value={newParticipantId}
            onChange={(event) => setNewParticipantId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Selecione um funcionário ativo</option>
            {directory.map((person) => (
              <option key={person.id} value={person.id}>{person.full_name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newParticipantId || creating}
            className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Criando..." : "Nova conversa"}
          </button>
        </form>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-sm text-slate-500">Carregando conversas...</p>
          ) : conversations.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Você ainda não participa de nenhuma conversa.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`w-full rounded-lg px-3 py-3 text-left transition ${selectedConversationId === conversation.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}
              >
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {conversation.title ?? "Conversa individual"}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {conversation.type === "group" ? "Grupo privado" : "Conversa privada"}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              {selectedConversation?.title ?? (selectedConversation ? "Conversa individual" : "Selecione uma conversa")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Sincronização: {selectedConversationId ? (realtimeStatus === "subscribed" ? "conectada" : realtimeStatus) : "desconectada"}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{userName}</span>
        </header>

        {errorMessage ? (
          <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-5">
          {!selectedConversation ? (
            <div className="flex h-full min-h-64 items-center justify-center text-center text-sm text-slate-500">
              Selecione uma conversa ou inicie uma nova conversa individual.
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-64 items-center justify-center text-center text-sm text-slate-500">
              Nenhuma mensagem ainda. Envie a primeira mensagem.
            </div>
          ) : (
            messages.map((message) => {
              const ownMessage = message.sender_id === userId;
              return (
                <article key={message.id} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[min(80%,42rem)] rounded-2xl px-4 py-3 shadow-sm ${ownMessage ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-900"}`}>
                    <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                    <time className={`mt-2 block text-right text-[10px] ${ownMessage ? "text-blue-100" : "text-slate-400"}`}>
                      {new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <form onSubmit={sendMessage} className="flex gap-3 border-t border-slate-200 bg-white p-4">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={4000}
            disabled={!selectedConversation || sending}
            placeholder={selectedConversation ? "Digite uma mensagem..." : "Selecione uma conversa para enviar mensagens"}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!selectedConversation || !draft.trim() || sending}
            className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </section>
    </section>
  );
}
