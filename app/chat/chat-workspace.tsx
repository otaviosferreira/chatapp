"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [activeMemberIds, setActiveMemberIds] = useState<string[]>([]);
  const [myMemberRole, setMyMemberRole] = useState<string | null>(null);
  const [newGroupMemberId, setNewGroupMemberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [updatingMembers, setUpdatingMembers] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [receipts, setReceipts] = useState<Tables<"message_receipts">[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const markMessagesRead = useCallback(async (items: Message[]) => {
    const incoming = items.filter((item) => item.sender_id !== userId);
    if (incoming.length === 0) return;
    const now = new Date().toISOString();
    const rows = incoming.map((item) => ({
      message_id: item.id, profile_id: userId, delivered_at: now, read_at: now
    }));
    const { error } = await supabase.from("message_receipts").upsert(rows, {
      onConflict: "message_id,profile_id", ignoreDuplicates: false
    });
    if (error) {
      setErrorMessage("Não foi possível atualizar as confirmações de leitura.");
      return;
    }
    const { data } = await supabase.from("message_receipts")
      .select("message_id,profile_id,delivered_at,read_at")
      .in("message_id", incoming.map((item) => item.id));
    if (data) setReceipts((current) => [
      ...current.filter((receipt) => !incoming.some((item) => item.id === receipt.message_id && receipt.profile_id === userId)),
      ...data
    ]);
  }, [supabase, userId]);

  const refreshUnreadCounts = useCallback(async () => {
    const ids = conversations.map((item) => item.id);
    if (ids.length === 0) { setUnreadCounts({}); return; }
    const { data: recentMessages, error } = await supabase.from("messages")
      .select("id,conversation_id,sender_id,client_message_id,body,reply_to_id,created_at")
      .in("conversation_id", ids).neq("sender_id", userId)
      .order("created_at", { ascending: false }).limit(500);
    if (error || !recentMessages) return;
    const messageIds = recentMessages.map((item) => item.id);
    const { data: readReceipts } = messageIds.length
      ? await supabase.from("message_receipts").select("message_id,read_at").eq("profile_id", userId).in("message_id", messageIds)
      : { data: [] as Pick<Tables<"message_receipts">, "message_id" | "read_at">[] };
    const readSet = new Set((readReceipts ?? []).filter((item) => item.read_at).map((item) => item.message_id));
    const counts: Record<string, number> = {};
    for (const item of recentMessages) if (!readSet.has(item.id)) counts[item.conversation_id] = (counts[item.conversation_id] ?? 0) + 1;
    setUnreadCounts(counts);
  }, [conversations, supabase, userId]);

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    setNotificationPermission(await Notification.requestPermission());
  }

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
    const activeConversationId = selectedConversationId ?? "";
    if (!activeConversationId) return;

    let active = true;
    const channel = supabase
      .channel(`conversation-messages-${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) =>
            current.some((item) => item.id === incoming.id)
              ? current
              : [...current, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at))
          );
          if (incoming.sender_id !== userId) {
            void markMessagesRead([incoming]);
            if (document.hidden && "Notification" in window && Notification.permission === "granted") {
              const conversation = conversations.find((item) => item.id === activeConversationId);
              new Notification(conversation?.title ?? "Nova mensagem", { body: incoming.body.slice(0, 140), tag: incoming.id });
            }
          }
          void refreshUnreadCounts();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_receipts" },
        (payload) => {
          const changed = (payload.new ?? payload.old) as Tables<"message_receipts">;
          setReceipts((current) => [
            ...current.filter((item) => !(item.message_id === changed.message_id && item.profile_id === changed.profile_id)),
            ...(payload.eventType === "DELETE" ? [] : [changed])
          ]);
        }
      )
      .subscribe((status) => {
        if (active) setRealtimeStatus(status.toLowerCase());
      });

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,client_message_id,body,reply_to_id,created_at")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      if (error) {
        setErrorMessage("Não foi possível carregar o histórico desta conversa.");
        return;
      }
      setMessages([...(data ?? [])].reverse());
      setHasMoreMessages((data ?? []).length === 100);
      await markMessagesRead(data ?? []);
      const loadedIds = (data ?? []).map((item) => item.id);
      if (loadedIds.length) {
        const { data: receiptRows } = await supabase.from("message_receipts")
          .select("message_id,profile_id,delivered_at,read_at").in("message_id", loadedIds);
        if (receiptRows) setReceipts(receiptRows);
      }
      await refreshUnreadCounts();
    }

    void loadMessages();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, selectedConversationId, userId, conversations, markMessagesRead, refreshUnreadCounts]);

  useEffect(() => { void Promise.resolve().then(refreshUnreadCounts); }, [refreshUnreadCounts, selectedConversationId]);

  useEffect(() => {
    if (conversations.length === 0) return;
    const conversationIds = new Set(conversations.map((item) => item.id));
    const channel = supabase.channel("user-conversation-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const incoming = payload.new as Message;
        if (incoming.sender_id === userId || !conversationIds.has(incoming.conversation_id) || incoming.conversation_id === selectedConversationId) return;
        void refreshUnreadCounts();
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          const conversation = conversations.find((item) => item.id === incoming.conversation_id);
          new Notification(conversation?.title ?? "Nova mensagem", {
            body: incoming.body.slice(0, 140),
            tag: incoming.id
          });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, conversations, selectedConversationId, userId, refreshUnreadCounts]);

  useEffect(() => {
    const conversationId = selectedConversationId ?? "";
    if (!conversationId) return;

    let active = true;
    async function loadMembers() {
      const { data, error } = await supabase
        .from("conversation_members")
        .select("profile_id,member_role")
        .eq("conversation_id", conversationId)
        .is("left_at", null);

      if (!active) return;
      if (error) {
        setErrorMessage("Não foi possível carregar os participantes desta conversa.");
        return;
      }
      setActiveMemberIds(data.map((member) => member.profile_id));
      setMyMemberRole(data.find((member) => member.profile_id === userId)?.member_role ?? null);
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, [supabase, selectedConversationId, userId]);

  async function searchMessages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchTerm.trim();
    if (term.length < 2 || searching) return;

    const conversationIds = conversations.map((conversation) => conversation.id);
    if (conversationIds.length === 0) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    setErrorMessage(null);
    const escapedTerm = term;
    const { data, error } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,client_message_id,body,reply_to_id,created_at")
      .in("conversation_id", conversationIds)
      .ilike("body", `%${escapedTerm}%`)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setErrorMessage("Não foi possível pesquisar as mensagens. Tente novamente.");
      setSearchResults([]);
    } else {
      setSearchResults(data ?? []);
    }
    setSearching(false);
  }

  async function loadOlderMessages() {
    if (!selectedConversationId || !messages[0] || loadingOlderMessages || !hasMoreMessages) return;
    setLoadingOlderMessages(true);
    const { data, error } = await supabase.from("messages")
      .select("id,conversation_id,sender_id,client_message_id,body,reply_to_id,created_at")
      .eq("conversation_id", selectedConversationId)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setErrorMessage("Não foi possível carregar mensagens anteriores.");
    } else {
      const older = [...(data ?? [])].reverse();
      setMessages((current) => [...older, ...current]);
      setHasMoreMessages((data ?? []).length === 100);
    }
    setLoadingOlderMessages(false);
  }

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

  async function addGroupMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversationId || !newGroupMemberId || updatingMembers || (myMemberRole !== "owner" && myMemberRole !== "admin")) return;

    setUpdatingMembers(true);
    setErrorMessage(null);
    const { error } = await supabase.from("conversation_members").insert({
      conversation_id: selectedConversationId,
      profile_id: newGroupMemberId,
      member_role: "member",
      added_by: userId
    });

    if (error) {
      setErrorMessage("Não foi possível adicionar o participante. Verifique suas permissões.");
    } else {
      setActiveMemberIds((current) => [...new Set([...current, newGroupMemberId])]);
      setNewGroupMemberId("");
    }
    setUpdatingMembers(false);
  }

  async function removeGroupMember(profileId: string) {
    if (!selectedConversationId || profileId === userId || updatingMembers || (myMemberRole !== "owner" && myMemberRole !== "admin")) return;

    setUpdatingMembers(true);
    setErrorMessage(null);
    const { error } = await supabase
      .from("conversation_members")
      .update({ left_at: new Date().toISOString() })
      .eq("conversation_id", selectedConversationId)
      .eq("profile_id", profileId);

    if (error) {
      setErrorMessage("Não foi possível remover o participante. Verifique suas permissões.");
    } else {
      setActiveMemberIds((current) => current.filter((id) => id !== profileId));
    }
    setUpdatingMembers(false);
  }

  async function leaveGroupConversation() {
    if (!selectedConversationId || selectedConversation?.type !== "group" || updatingMembers) return;

    setUpdatingMembers(true);
    setErrorMessage(null);
    const { error } = await supabase
      .from("conversation_members")
      .update({ left_at: new Date().toISOString() })
      .eq("conversation_id", selectedConversationId)
      .eq("profile_id", userId);

    if (error) {
      setErrorMessage("Não foi possível sair do grupo. Tente novamente.");
    } else {
      setConversations((current) => current.filter((item) => item.id !== selectedConversationId));
      setSelectedConversationId(null);
      setMessages([]);
      setActiveMemberIds([]);
      setMyMemberRole(null);
      setNewGroupMemberId("");
    }
    setUpdatingMembers(false);
  }

  async function createGroupConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = groupTitle.trim();
    if (!title || groupMemberIds.length < 1 || groupMemberIds.length > 49 || creatingGroup) return;

    setCreatingGroup(true);
    setErrorMessage(null);

    const { data, error } = await supabase.rpc("create_conversation", {
      _type: "group",
      _title: title,
      _member_ids: groupMemberIds
    });

    if (error || !data) {
      setErrorMessage("Não foi possível criar o grupo. Verifique título e participantes ativos.");
      setCreatingGroup(false);
      return;
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("conversations")
      .select("id,type,title,created_by,direct_key,created_at,archived_at")
      .eq("id", data)
      .single();

    if (!refreshError && refreshed) {
      setConversations((current) => [refreshed, ...current.filter((item) => item.id !== refreshed.id)]);
      setSelectedConversationId(refreshed.id);
      setGroupTitle("");
      setGroupMemberIds([]);
    } else {
      setErrorMessage("Grupo criado, mas não foi possível atualizar a lista. Atualize a página.");
    }

    setCreatingGroup(false);
  }

  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);

  return (
    <section className="mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-h-[280px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
          <p className="mt-1 text-xs text-slate-500">Somente conversas privadas das quais você participa.</p>
        </div>

        <form onSubmit={searchMessages} className="mb-4 space-y-2">
          <label htmlFor="message-search" className="block text-xs font-medium text-slate-600">Pesquisar mensagens</label>
          <div className="flex gap-2">
            <input
              id="message-search"
              value={searchTerm}
              onChange={(event) => { setSearchTerm(event.target.value); setHasSearched(false); }}
              minLength={2}
              maxLength={120}
              placeholder="Buscar em suas conversas"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={searchTerm.trim().length < 2 || searching}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {searching ? "..." : "Buscar"}
            </button>
          </div>
          {searchResults.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2" aria-live="polite">
              <p className="px-2 py-1 text-xs text-slate-500">{searchResults.length} resultado(s), limite de 30</p>
              {searchResults.map((result) => {
                const conversation = conversations.find((item) => item.id === result.conversation_id);
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => { setSelectedConversationId(result.conversation_id); setSearchResults([]); }}
                    className="block w-full rounded-md px-2 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="block text-xs font-semibold text-blue-700">{conversation?.title ?? "Conversa individual"}</span>
                    <span className="mt-1 block line-clamp-2 text-xs text-slate-700">{result.body}</span>
                    <time className="mt-1 block text-[10px] text-slate-400">{new Date(result.created_at).toLocaleString("pt-BR")}</time>
                  </button>
                );
              })}
            </div>
          ) : hasSearched && searchTerm.trim().length >= 2 && !searching ? (
            <p className="text-xs text-slate-500">Sem resultados para a última pesquisa.</p>
          ) : null}
        </form>

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

        <form onSubmit={createGroupConversation} className="mb-4 space-y-2 border-t border-slate-100 pt-4">
          <label className="block text-xs font-medium text-slate-600" htmlFor="group-title">
            Criar grupo privado
          </label>
          <input
            id="group-title"
            value={groupTitle}
            onChange={(event) => setGroupTitle(event.target.value)}
            maxLength={100}
            placeholder="Nome do grupo"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="block text-xs text-slate-500" htmlFor="group-members">
            Selecione de 1 a 49 participantes (Ctrl/Cmd para múltipla seleção)
          </label>
          <select
            id="group-members"
            multiple
            size={4}
            value={groupMemberIds}
            onChange={(event) => setGroupMemberIds(Array.from(event.target.selectedOptions, (option) => option.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {directory.map((person) => (
              <option key={person.id} value={person.id}>{person.full_name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!groupTitle.trim() || groupMemberIds.length < 1 || groupMemberIds.length > 49 || creatingGroup}
            className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingGroup ? "Criando grupo..." : "Criar grupo"}
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
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{conversation.type === "group" ? "Grupo privado" : "Conversa privada"}</span>
                  {(unreadCounts[conversation.id] ?? 0) > 0 ? (
                    <span className="rounded-full bg-blue-700 px-2 py-0.5 text-[10px] font-semibold text-white">{unreadCounts[conversation.id]}</span>
                  ) : null}
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
          <div className="flex items-center gap-2">
            {notificationPermission !== "granted" ? (
              <button type="button" onClick={() => void requestNotifications()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Ativar notificações</button>
            ) : <span className="text-[10px] text-emerald-700">Notificações ativadas</span>}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{userName}</span>
          </div>
        </header>

        {errorMessage ? (
          <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {selectedConversation?.type === "group" ? (
          <div className="border-b border-slate-200 bg-white px-5 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Participantes ativos ({activeMemberIds.length})
              </p>
              <button
                type="button"
                disabled={updatingMembers}
                onClick={() => void leaveGroupConversation()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {updatingMembers ? "Aguarde..." : "Sair do grupo"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeMemberIds.map((memberId) => {
                const memberName = memberId === userId
                  ? userName
                  : directory.find((person) => person.id === memberId)?.full_name ?? "Funcionário";
                return (
                  <span key={memberId} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {memberName}
                    {(myMemberRole === "owner" || myMemberRole === "admin") && memberId !== userId ? (
                      <button
                        type="button"
                        disabled={updatingMembers}
                        onClick={() => void removeGroupMember(memberId)}
                        className="font-semibold text-red-700 hover:underline disabled:opacity-50"
                        aria-label={`Remover ${memberName} do grupo`}
                      >
                        Remover
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
            {(myMemberRole === "owner" || myMemberRole === "admin") ? (
              <form onSubmit={addGroupMember} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  value={newGroupMemberId}
                  onChange={(event) => setNewGroupMemberId(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Adicionar funcionário ativo</option>
                  {directory.filter((person) => !activeMemberIds.includes(person.id)).map((person) => (
                    <option key={person.id} value={person.id}>{person.full_name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!newGroupMemberId || updatingMembers}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
                >
                  {updatingMembers ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-5">
          {selectedConversation && hasMoreMessages ? (
            <div className="flex justify-center">
              <button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlderMessages} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 disabled:opacity-50">
                {loadingOlderMessages ? "Carregando..." : "Carregar mensagens anteriores"}
              </button>
            </div>
          ) : null}
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
                    <div className={`mt-2 flex items-center justify-end gap-2 text-[10px] ${ownMessage ? "text-blue-100" : "text-slate-400"}`}>
                      <time>{new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                      {ownMessage ? (() => {
                        const readCount = receipts.filter((receipt) => receipt.message_id === message.id && receipt.profile_id !== userId && receipt.read_at).length;
                        const recipientCount = Math.max(activeMemberIds.length - 1, 1);
                        return <span>{readCount > 0 ? `✓✓ Lida por ${readCount}/${recipientCount}` : "✓ Enviada"}</span>;
                      })() : null}
                    </div>
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
