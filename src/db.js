const { supabase } = require("./config");
const { logInfo, logError } = require("./utils");

async function findUserByLineUserId(lineUserId) {
  if (!lineUserId) return null;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error) {
    console.error("Load user failed:", { error: error.message, lineUserId, time: new Date().toISOString() });
    return null;
  }
  return data || null;
}

async function findUserById(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Load user by id failed:", { error: error.message, userId, time: new Date().toISOString() });
    return null;
  }
  return data || null;
}

async function findConversationBinding(bindingKey) {
  if (!bindingKey?.conversationId) return null;
  const { data, error } = await supabase
    .from("conversation_users")
    .select("user_id, translation_enabled, mode, from_lang, to_lang")
    .eq("source_type", bindingKey.sourceType)
    .eq("conversation_id", bindingKey.conversationId)
    .maybeSingle();
  if (error) {
    console.error("Load conversation user failed:", {
      error: error.message,
      sourceType: bindingKey.sourceType,
      conversationId: bindingKey.conversationId,
      time: new Date().toISOString(),
    });
    return null;
  }
  if (!data) return null;

  const user = await findUserById(data.user_id);
  if (!user) {
    console.warn("Conversation binding has no valid user:", {
      sourceType: bindingKey.sourceType,
      conversationId: bindingKey.conversationId,
      userId: data.user_id,
      time: new Date().toISOString(),
    });
  }
  return {
    userId: data.user_id,
    translationEnabled: data.translation_enabled !== false,
    mode: data.mode || "",
    from_lang: data.from_lang || "",
    to_lang: data.to_lang || "",
    user,
  };
}

async function bindConversationToUser(bindingKey, userId) {
  if (!bindingKey?.conversationId || !userId) return "skipped";
  const { error } = await supabase
    .from("conversation_users")
    .insert({
      source_type: bindingKey.sourceType,
      conversation_id: bindingKey.conversationId,
      user_id: userId,
    });
  if (error) {
    if (error.code === "23505") return "exists";
    console.warn("Bind conversation user failed:", {
      error: error.message,
      sourceType: bindingKey.sourceType,
      conversationId: bindingKey.conversationId,
      userId,
      time: new Date().toISOString(),
    });
    return "failed";
  }
  console.log("Conversation bound to user:", {
    sourceType: bindingKey.sourceType,
    conversationId: bindingKey.conversationId,
    userId,
    time: new Date().toISOString(),
  });
  return "created";
}

async function unbindConversationIfUser(bindingKey, userId, reason = "unknown", lineUserId = "") {
  if (!bindingKey?.conversationId || !userId) return false;
  const { data, error } = await supabase
    .from("conversation_users")
    .delete()
    .eq("source_type", bindingKey.sourceType)
    .eq("conversation_id", bindingKey.conversationId)
    .eq("user_id", userId)
    .select("id");
  if (error) {
    logError("conversation_unbind_failed", {
      error: error.message, reason,
      sourceType: bindingKey.sourceType, conversationId: bindingKey.conversationId,
      userId, time: new Date().toISOString(),
    });
    return false;
  }
  if ((data || []).length > 0) {
    logInfo("conversation_unbound", {
      reason, sourceType: bindingKey.sourceType, conversationId: bindingKey.conversationId,
      userId, time: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

async function unbindConversation(bindingKey, reason = "unknown") {
  if (!bindingKey?.conversationId) return false;
  const { data, error } = await supabase
    .from("conversation_users")
    .delete()
    .eq("source_type", bindingKey.sourceType)
    .eq("conversation_id", bindingKey.conversationId)
    .select("id, user_id");
  if (error) {
    logError("conversation_unbind_failed", {
      error: error.message, reason,
      sourceType: bindingKey.sourceType, conversationId: bindingKey.conversationId,
      time: new Date().toISOString(),
    });
    return false;
  }
  if ((data || []).length > 0) {
    logInfo("conversation_unbound", {
      reason, sourceType: bindingKey.sourceType, conversationId: bindingKey.conversationId,
      userIds: (data || []).map((row) => row.user_id).filter(Boolean),
      time: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

async function setConversationTranslationEnabled(bindingKey, enabled) {
  if (!bindingKey?.conversationId) return false;
  const { error } = await supabase
    .from("conversation_users")
    .update({ translation_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("source_type", bindingKey.sourceType)
    .eq("conversation_id", bindingKey.conversationId);
  if (error) {
    console.warn("Update conversation translation switch failed:", {
      error: error.message, sourceType: bindingKey.sourceType,
      conversationId: bindingKey.conversationId, enabled, time: new Date().toISOString(),
    });
    return false;
  }
  return true;
}

async function setConversationLanguageConfig(bindingKey, config) {
  if (!bindingKey?.conversationId) return false;
  const { error } = await supabase
    .from("conversation_users")
    .update({ mode: config.mode, from_lang: config.from_lang, to_lang: config.to_lang, updated_at: new Date().toISOString() })
    .eq("source_type", bindingKey.sourceType)
    .eq("conversation_id", bindingKey.conversationId);
  if (error) {
    console.warn("Update conversation language config failed:", {
      error: error.message, sourceType: bindingKey.sourceType,
      conversationId: bindingKey.conversationId, config, time: new Date().toISOString(),
    });
    return false;
  }
  return true;
}

async function touchUser(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from("users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    console.warn("Touch user failed:", { error: error.message, userId, time: new Date().toISOString() });
  }
}

async function chargeUserUsage(userId, chargedChars) {
  if (chargedChars <= 0) return true;
  const { data, error } = await supabase.rpc("increment_user_usage", {
    p_user_id: userId,
    p_chars: chargedChars,
  });
  if (!error) {
    return Array.isArray(data) ? data.length > 0 : Boolean(data);
  }
  console.warn("RPC increment_user_usage failed:", {
    error: error.message, userId, chargedChars, time: new Date().toISOString(),
  });
  return false;
}

function sanitizeAdminSearchTerm(value) {
  return String(value || "").trim().replace(/[,%]/g, " ").slice(0, 80);
}

function applyUserSearch(query, searchTerm) {
  if (!searchTerm) return query;
  const pattern = `*${searchTerm}*`;
  return query.or(`line_user_id.ilike.${pattern},name.ilike.${pattern},notes.ilike.${pattern}`);
}

async function loadConversationBindings(limit = 50, search = "") {
  const searchTerm = sanitizeAdminSearchTerm(search);
  let query = supabase
    .from("conversation_users")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (searchTerm) {
    query = query.ilike("conversation_id", `%${searchTerm}%`);
  }
  const { data, error } = await query;
  if (error) throw error;

  const bindings = data || [];
  const userIds = [...new Set(bindings.map((b) => b.user_id).filter(Boolean))];
  let usersById = new Map();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, line_user_id, name, status, expires_at")
      .in("id", userIds);
    if (usersError) throw usersError;
    usersById = new Map((users || []).map((u) => [u.id, u]));
  }
  return bindings.map((binding) => ({ ...binding, user: usersById.get(binding.user_id) || null }));
}

async function loadRenewalHistory(userId, limit = 10) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_renewals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function loadAdminData(renewUserId = "", search = "", conversationSearch = "", quickUserId = "") {
  const trimmedRenewUserId = String(renewUserId || "").trim();
  const trimmedQuickUserId = String(quickUserId || "").trim();
  const safeLimit = 20;
  const searchTerm = sanitizeAdminSearchTerm(search);
  const conversationSearchTerm = sanitizeAdminSearchTerm(conversationSearch);
  const usersQuery = applyUserSearch(
    supabase.from("users").select("*").order("expires_at", { ascending: true }).limit(safeLimit),
    searchTerm
  );
  const queries = [usersQuery, loadConversationBindings(50, conversationSearchTerm)];
  if (trimmedRenewUserId) {
    queries.push(
      supabase.from("users").select("*").eq("line_user_id", trimmedRenewUserId).maybeSingle()
    );
  }
  if (trimmedQuickUserId) {
    queries.push(
      supabase.from("users").select("*").eq("line_user_id", trimmedQuickUserId).maybeSingle()
    );
  }
  const results = await Promise.all(queries);
  const [{ data: users, error: usersError }, conversationBindings] = results;
  const renewResult = trimmedRenewUserId ? results[2] : null;
  const quickResult = trimmedQuickUserId ? results[trimmedRenewUserId ? 3 : 2] : null;
  if (usersError) throw usersError;
  if (renewResult?.error) throw renewResult.error;
  if (quickResult?.error) throw quickResult.error;
  const renewalHistory = await loadRenewalHistory(renewResult?.data?.id);
  return {
    users: users || [],
    conversationBindings,
    renewUser: renewResult?.data || null,
    renewalHistory,
    renewUserId: trimmedRenewUserId,
    renewUserNotFound: Boolean(trimmedRenewUserId && !renewResult?.data),
    quickUser: quickResult?.data || null,
    quickUserId: trimmedQuickUserId,
    quickUserNotFound: Boolean(trimmedQuickUserId && !quickResult?.data),
    searchTerm,
    conversationSearchTerm,
  };
}

module.exports = {
  findUserByLineUserId,
  findUserById,
  findConversationBinding,
  bindConversationToUser,
  unbindConversationIfUser,
  unbindConversation,
  setConversationTranslationEnabled,
  setConversationLanguageConfig,
  touchUser,
  chargeUserUsage,
  sanitizeAdminSearchTerm,
  applyUserSearch,
  loadConversationBindings,
  loadRenewalHistory,
  loadAdminData,
};
