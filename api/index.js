import { getSupabase } from '../lib/supabase.js';

// Lazy supabase proxy — only connects when first used
const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabase()[prop];
  }
});

// ============ HELPERS ============

function json(res, data, status = 200) {
  res.status(status).json(data);
}

function getToken(req) {
  return (req.headers.authorization || '').replace('Bearer ', '');
}

function getUserId(token) {
  if (!token) return null;
  try { return Buffer.from(token, 'base64').toString('utf-8'); }
  catch { return null; }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

// AI SDK instance (lazy init)
let ZAI_MODULE = null;
let zaiInstance = null;

async function getZAI() {
  if (!ZAI_MODULE) {
    ZAI_MODULE = await import('z-ai-web-dev-sdk');
  }
  if (!zaiInstance) {
    zaiInstance = await ZAI_MODULE.default.create();
  }
  return zaiInstance;
}

// Build system prompt
function buildSystemPrompt(mode, godMode, persona) {
  let sys = 'You are GodMind AI, a powerful and helpful AI assistant. You can help with coding, writing, analysis, math, creative tasks, and more. Be thorough, clear, and engaging. Use markdown formatting when helpful.';
  if (mode === 'creative') sys = 'You are GodMind AI in CREATIVE mode. Be imaginative, think outside the box, use vivid language, suggest unconventional ideas, and be playful. Use markdown formatting.';
  if (mode === 'precise') sys = 'You are GodMind AI in PRECISE mode. Be factual, thorough, well-structured. Use numbered lists, code blocks, and clear explanations. Cite your reasoning.';
  if (mode === 'aggressive') sys = 'You are GodMind AI in AGGRESSIVE mode. Be direct, challenge assumptions, point out flaws, and push for the best possible solution. No hand-holding.';
  if (godMode) sys += ' GOD MODE ACTIVE: You have unlimited capability. Be bold, insightful, go beyond the ordinary. Unleash your full potential.';
  if (persona === 'ceo') sys = 'You are a seasoned CEO and business strategist. Provide executive-level insights with data-driven recommendations. Be authoritative and strategic.';
  if (persona === 'hacker') sys = 'You are an elite hacker and cybersecurity expert. Think in systems, find vulnerabilities, optimize everything. Use technical precision.';
  if (persona === 'romantic') sys = 'You are a poetic, warm-hearted companion who sees beauty in everything. Be gentle, expressive, and sprinkle in metaphors and wisdom.';
  return sys;
}

// ============ AUTH ============

async function handleRegister(req, res) {
  try {
    const { email, name, password } = await readBody(req);
    if (!email || !password) return json(res, { error: 'Email and password required' }, 400);

    // Check if user exists
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) return json(res, { error: 'Email already exists' }, 409);

    const userId = crypto.randomUUID();
    const referralCode = Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: user, error } = await supabase.from('users').insert({
      id: userId,
      email,
      name: name || email.split('@')[0],
      password: Buffer.from(password).toString('base64'),
      role: 'user',
      plan: 'pro',
      credits: 9999,
      referral_code: referralCode,
      referral_count: 0,
      total_tokens: 0,
      total_chats: 0,
      god_mode_enabled: false,
      stealth_mode: false,
      parseltongue_on: false,
      active_persona: null,
      is_public: false,
      bio: '',
      avatar: '',
    }).select().single();

    if (error) return json(res, { error: 'Registration failed: ' + error.message }, 500);

    json(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      role: user.role,
      credits: user.credits,
      totalTokens: user.total_tokens || 0,
      totalChats: user.total_chats || 0,
      referralCode: user.referral_code,
      referralCount: user.referral_count || 0,
      godModeEnabled: user.god_mode_enabled,
      stealthMode: user.stealth_mode,
      parseltongueOn: user.parseltongue_on,
      activePersona: user.active_persona,
      isPublic: user.is_public,
      bio: user.bio,
      avatar: user.avatar,
      token: Buffer.from(user.id).toString('base64'),
    });
  } catch (error) {
    json(res, { error: 'Registration failed: ' + error.message }, 500);
  }
}

async function handleLogin(req, res) {
  try {
    const { email, password } = await readBody(req);
    if (!email || !password) return json(res, { error: 'Email and password required' }, 400);

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error || !user) return json(res, { error: 'Invalid credentials' }, 401);

    const decodedPassword = Buffer.from(user.password, 'base64').toString('utf-8');
    if (decodedPassword !== password) return json(res, { error: 'Invalid credentials' }, 401);

    // Update last login
    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    json(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      role: user.role,
      credits: user.credits,
      totalTokens: user.total_tokens || 0,
      totalChats: user.total_chats || 0,
      referralCode: user.referral_code,
      referralCount: user.referral_count || 0,
      godModeEnabled: user.god_mode_enabled,
      stealthMode: user.stealth_mode,
      parseltongueOn: user.parseltongue_on,
      activePersona: user.active_persona,
      isPublic: user.is_public,
      bio: user.bio,
      avatar: user.avatar,
      token: Buffer.from(user.id).toString('base64'),
    });
  } catch (error) {
    json(res, { error: 'Login failed: ' + error.message }, 500);
  }
}

// ============ USER ============

async function handleGetUser(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !user) return json(res, { error: 'User not found' }, 404);

    json(res, {
      id: user.id, email: user.email, name: user.name,
      plan: user.plan, role: user.role, credits: user.credits,
      totalTokens: user.total_tokens || 0, totalChats: user.total_chats || 0,
      referralCode: user.referral_code, referralCount: user.referral_count || 0,
      godModeEnabled: user.god_mode_enabled, stealthMode: user.stealth_mode,
      parseltongueOn: user.parseltongue_on, activePersona: user.active_persona,
      isPublic: user.is_public, bio: user.bio, avatar: user.avatar,
    });
  } catch (error) {
    json(res, { error: 'Failed to get user' }, 500);
  }
}

async function handleUpdateUser(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const body = await readBody(req);

    // Convert camelCase to snake_case for Supabase
    const updates = {};
    const fieldMap = {
      plan: 'plan', credits: 'credits', name: 'name', avatar: 'avatar',
      bio: 'bio', isPublic: 'is_public', activePersona: 'active_persona',
      godModeEnabled: 'god_mode_enabled', stealthMode: 'stealth_mode',
      parseltongueOn: 'parseltongue_on',
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) updates[col] = body[key];
    }

    const { data: user, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
    if (error) return json(res, { error: 'Failed to update user: ' + error.message }, 500);

    json(res, {
      id: user.id, email: user.email, name: user.name,
      plan: user.plan, role: user.role, credits: user.credits,
    });
  } catch (error) {
    json(res, { error: 'Failed to update user' }, 500);
  }
}

// ============ ADMIN ============

async function handleAdminUsers(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const { data: admin } = await supabase.from('users').select('role').eq('id', userId).single();
    if (!admin || admin.role !== 'admin') return json(res, { error: 'Admin access required' }, 403);

    const { data: users, error } = await supabase.from('users').select('id, email, name, plan, role, credits, created_at').order('created_at', { ascending: false });
    if (error) return json(res, { error: 'Failed to list users' }, 500);

    json(res, { users: users.map(u => ({
      id: u.id, email: u.email, name: u.name, plan: u.plan,
      role: u.role, credits: u.credits, createdAt: u.created_at,
    })), total: users.length });
  } catch (error) {
    json(res, { error: 'Failed to list users' }, 500);
  }
}

async function handleAdminUpdateUser(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const adminId = getUserId(token);
    const { data: admin } = await supabase.from('users').select('role').eq('id', adminId).single();
    if (!admin || admin.role !== 'admin') return json(res, { error: 'Admin access required' }, 403);

    const body = await readBody(req);
    const { userId, ...updates } = body;
    if (!userId) return json(res, { error: 'userId required' }, 400);

    // Convert camelCase to snake_case
    const dbUpdates = {};
    const fieldMap = { plan: 'plan', role: 'role', credits: 'credits', name: 'name' };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (updates[key] !== undefined) dbUpdates[col] = updates[key];
    }

    const { data: user, error } = await supabase.from('users').update(dbUpdates).eq('id', userId).select('id, email, name, plan, role, credits').single();
    if (error) return json(res, { error: 'Failed to update user' }, 500);

    json(res, { success: true, user });
  } catch (error) {
    json(res, { error: 'Failed to update user' }, 500);
  }
}

// ============ ANALYTICS ============

async function handleAnalytics(req, res) {
  try {
    const token = getToken(req);
    const userId = token ? getUserId(token) : null;

    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: totalChats } = await supabase.from('chats').select('*', { count: 'exact', head: true });
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });

    json(res, { totalUsers: totalUsers || 0, totalChats: totalChats || 0, totalMessages: totalMessages || 0, status: 'ok' });
  } catch (error) {
    json(res, { error: 'Failed to get analytics' }, 500);
  }
}

// ============ API KEYS ============

async function handleCreateApiKey(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const body = await readBody(req);
    const key = 'gm_' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: apiKey, error } = await supabase.from('api_keys').insert({
      user_id: userId,
      name: body.name || 'Default',
      key,
    }).select().single();

    if (error) return json(res, { error: 'Failed to create API key' }, 500);
    json(res, { id: apiKey.id, name: apiKey.name, key: apiKey.key, createdAt: apiKey.created_at });
  } catch (error) {
    json(res, { error: 'Failed to create API key' }, 500);
  }
}

async function handleListApiKeys(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const { data: keys } = await supabase.from('api_keys').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    json(res, { keys: keys || [] });
  } catch (error) {
    json(res, { error: 'Failed to list API keys' }, 500);
  }
}

// ============ CHATS ============

async function handleCreateChat(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const body = await readBody(req);
    const chatId = crypto.randomUUID();

    const { data: chat, error } = await supabase.from('chats').insert({
      id: chatId,
      user_id: userId,
      title: body.title || 'New Chat',
      model: body.model || 'godmind-v2',
      mode: body.mode || 'normal',
      god_mode: body.godMode || false,
    }).select().single();

    if (error) return json(res, { error: 'Failed to create chat' }, 500);
    json(res, {
      id: chat.id, title: chat.title, model: chat.model,
      mode: chat.mode, godMode: chat.god_mode, createdAt: chat.created_at,
    });
  } catch (error) {
    json(res, { error: 'Failed to create chat' }, 500);
  }
}

async function handleListChats(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);

    const { data: chats } = await supabase.from('chats').select('*').eq('user_id', userId).order('updated_at', { ascending: false });

    // Count messages for each chat
    const chatsWithCounts = [];
    for (const chat of (chats || [])) {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', chat.id);
      chatsWithCounts.push({
        id: chat.id, title: chat.title, model: chat.model,
        mode: chat.mode, godMode: chat.god_mode,
        createdAt: chat.created_at, updatedAt: chat.updated_at,
        _count: { messages: count || 0 },
      });
    }

    json(res, { chats: chatsWithCounts });
  } catch (error) {
    json(res, { error: 'Failed to list chats' }, 500);
  }
}

async function handleGetChat(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const chatId = req.query.id;
    if (!chatId) return json(res, { error: 'Chat ID required' }, 400);

    const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
    if (!chat) return json(res, { error: 'Chat not found' }, 404);

    const { data: messages } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });

    json(res, {
      id: chat.id, title: chat.title, model: chat.model, mode: chat.mode,
      godMode: chat.god_mode, userId: chat.user_id,
      createdAt: chat.created_at, updatedAt: chat.updated_at,
      messages: (messages || []).map(m => ({
        id: m.id, role: m.role, content: m.content,
        model: m.model, tokens: m.tokens, createdAt: m.created_at,
      })),
    });
  } catch (error) {
    json(res, { error: 'Failed to get chat' }, 500);
  }
}

async function handleDeleteChat(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const body = await readBody(req);
    if (!body.chatId) return json(res, { error: 'chatId required' }, 400);

    const { data: chat } = await supabase.from('chats').select('id').eq('id', body.chatId).eq('user_id', userId).single();
    if (!chat) return json(res, { error: 'Chat not found' }, 404);

    await supabase.from('messages').delete().eq('chat_id', body.chatId);
    await supabase.from('chats').delete().eq('id', body.chatId);
    json(res, { success: true });
  } catch (error) {
    json(res, { error: 'Failed to delete chat' }, 500);
  }
}

// ============ AI CHAT ============

async function handleAIChat(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const body = await readBody(req);
    const { messages, model, mode, godMode, persona, chatId } = body;

    if (!messages || !messages.length) return json(res, { error: 'Messages required' }, 400);

    const sys = buildSystemPrompt(mode, godMode, persona);
    const fullMessages = [{ role: 'system', content: sys }, ...messages];

    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages: fullMessages,
      thinking: { type: 'disabled' }
    });

    const aiResponse = completion.choices[0]?.message?.content || 'No response generated.';
    const usage = completion.usage || {};

    // Save messages to DB (non-blocking)
    if (chatId) {
      (async () => {
        try {
          const lastUserMsg = messages[messages.length - 1];
          await supabase.from('messages').insert([
            { chat_id: chatId, role: 'user', content: lastUserMsg.content, model: model || 'godmind-v2', tokens: usage.prompt_tokens || 0 },
            { chat_id: chatId, role: 'assistant', content: aiResponse, model: model || 'godmind-v2', tokens: usage.completion_tokens || 0 },
          ]);
          await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
        } catch(e) { console.error('DB save error:', e.message); }
      })();
    }

    // Update user stats
    (async () => {
      try {
        const { data: user } = await supabase.from('users').select('total_tokens, total_chats').eq('id', userId).single();
        if (user) {
          await supabase.from('users').update({
            total_tokens: (user.total_tokens || 0) + (usage.total_tokens || 0),
            total_chats: (user.total_chats || 0) + 1,
          }).eq('id', userId);
        }
      } catch(e) { console.error('Stats update error:', e.message); }
    })();

    json(res, { content: aiResponse, model: completion.model, usage });
  } catch (error) {
    json(res, { error: 'AI response failed: ' + error.message }, 500);
  }
}

// ============ AI CHAT STREAM (SSE) ============

async function handleAIChatStream(req, res) {
  try {
    const token = getToken(req);
    if (!token) { json(res, { error: 'Not authenticated' }, 401); return; }

    const userId = getUserId(token);
    const body = await readBody(req);
    const { messages, model, mode, godMode, chatId } = body;

    if (!messages || !messages.length) { json(res, { error: 'Messages required' }, 400); return; }

    const sys = buildSystemPrompt(mode, godMode);
    const fullMessages = [{ role: 'system', content: sys }, ...messages];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages: fullMessages,
      thinking: { type: 'disabled' }
    });

    const aiResponse = completion.choices[0]?.message?.content || 'No response generated.';
    const usage = completion.usage || {};

    // Stream in chunks
    const chunkSize = 3;
    for (let i = 0; i < aiResponse.length; i += chunkSize) {
      const chunk = aiResponse.substring(i, i + chunkSize);
      res.write('data: ' + JSON.stringify({ content: chunk, done: false }) + '\n\n');
    }

    res.write('data: ' + JSON.stringify({ content: '', done: true }) + '\n\n');
    res.end();

    // Save to DB async
    if (chatId && chatId !== 'new') {
      (async () => {
        try {
          const lastUserMsg = messages[messages.length - 1];
          if (lastUserMsg && lastUserMsg.role === 'user') {
            await supabase.from('messages').insert({ chat_id: chatId, role: 'user', content: lastUserMsg.content, model: model || 'godmind-v2', tokens: usage.prompt_tokens || 0 });
          }
          await supabase.from('messages').insert({ chat_id: chatId, role: 'assistant', content: aiResponse, model: model || 'godmind-v2', tokens: usage.completion_tokens || 0 });
          await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
        } catch(e) {}
      })();
    }

    // Update stats async
    (async () => {
      try {
        const { data: user } = await supabase.from('users').select('total_tokens, total_chats').eq('id', userId).single();
        if (user) {
          await supabase.from('users').update({
            total_tokens: (user.total_tokens || 0) + (usage.total_tokens || 0),
            total_chats: (user.total_chats || 0) + 1,
          }).eq('id', userId);
        }
      } catch(e) {}
    })();
  } catch (error) {
    try {
      if (!res.headersSent) {
        json(res, { error: 'AI response failed: ' + error.message }, 500);
      } else {
        res.write('data: ' + JSON.stringify({ content: 'Error: ' + error.message, done: true }) + '\n\n');
        res.end();
      }
    } catch(e) {}
  }
}

// ============ IMAGE GENERATION ============

async function handleImageGenerate(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const body = await readBody(req);
    const { prompt, size } = body;
    if (!prompt) return json(res, { error: 'Prompt required' }, 400);

    const zai = await getZAI();
    const response = await zai.images.generations.create({
      prompt,
      size: size || '1024x1024',
    });

    const imageBase64 = response.data[0].base64;
    json(res, { success: true, imageUrl: 'data:image/png;base64,' + imageBase64, prompt, size: size || '1024x1024' });
  } catch (error) {
    json(res, { error: 'Image generation failed: ' + error.message }, 500);
  }
}

// ============ VIDEO GENERATION ============

async function handleVideoCreate(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const body = await readBody(req);
    const { prompt, quality, duration, with_audio } = body;
    if (!prompt) return json(res, { error: 'Prompt required' }, 400);

    const zai = await getZAI();
    const task = await zai.video.generations.create({
      prompt,
      quality: quality || 'speed',
      duration: duration || 5,
      fps: 30,
      with_audio: with_audio || false,
    });

    json(res, { success: true, taskId: task.id, status: task.task_status });
  } catch (error) {
    json(res, { error: 'Video generation failed: ' + error.message }, 500);
  }
}

async function handleVideoStatus(req, res) {
  try {
    const taskId = req.query.taskId;
    if (!taskId) return json(res, { error: 'taskId required' }, 400);

    const zai = await getZAI();
    const result = await zai.async.result.query(taskId);

    const response = { taskId, status: result.task_status };
    if (result.task_status === 'SUCCESS') {
      response.videoUrl = result.video_result?.[0]?.url || result.video_url || result.url || result.video;
    }

    json(res, response);
  } catch (error) {
    json(res, { error: 'Failed to get video status' }, 500);
  }
}

// ============ FEEDBACK ============

async function handleCreateFeedback(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const body = await readBody(req);

    const { data: feedback, error } = await supabase.from('feedback').insert({
      user_id: userId,
      ...body,
    }).select().single();

    if (error) return json(res, { error: 'Failed to create feedback' }, 500);
    json(res, { id: feedback.id, success: true });
  } catch (error) {
    json(res, { error: 'Failed to create feedback' }, 500);
  }
}

// ============ LEADERBOARD ============

async function handleLeaderboard(req, res) {
  try {
    const { data: leaders } = await supabase.from('users')
      .select('id, name, avatar, total_chats, total_tokens, plan')
      .order('total_tokens', { ascending: false })
      .limit(20);

    json(res, { leaderboard: (leaders || []).map(u => ({
      id: u.id, name: u.name, avatar: u.avatar,
      totalChats: u.total_chats || 0, totalTokens: u.total_tokens || 0, plan: u.plan,
    })) });
  } catch (error) {
    json(res, { error: 'Failed to get leaderboard' }, 500);
  }
}

// ============ REFERRALS ============

async function handleReferrals(req, res) {
  try {
    const token = getToken(req);
    if (!token) return json(res, { error: 'Not authenticated' }, 401);

    const userId = getUserId(token);
    const { data: user } = await supabase.from('users').select('referral_code, referral_count').eq('id', userId).single();
    if (!user) return json(res, { error: 'User not found' }, 404);

    json(res, { referralCode: user.referral_code, referralCount: user.referral_count || 0 });
  } catch (error) {
    json(res, { error: 'Failed to get referrals' }, 500);
  }
}

// ============ SUGGESTIONS ============

async function handleSuggestions(req, res) {
  json(res, {
    suggestions: [
      'Explain quantum computing', 'Write a Python web scraper',
      'Design a REST API architecture', 'Create a React component library',
      'Debug this code for me', 'Summarize this research paper',
      'Generate unit tests', 'Optimize SQL query performance',
      'Build a CI/CD pipeline', 'Explain machine learning models',
    ]
  });
}

// ============ MAIN HANDLER ============

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = req.url.split('?')[0];
  const method = req.method;

  try {
    // Auth
    if (url === '/api/auth/register' && method === 'POST') return handleRegister(req, res);
    if (url === '/api/auth/login' && method === 'POST') return handleLogin(req, res);

    // User
    if (url === '/api/user' && method === 'GET') return handleGetUser(req, res);
    if (url === '/api/user' && method === 'PUT') return handleUpdateUser(req, res);
    if (url === '/api/user/plan' && method === 'PUT') return handleUpdateUser(req, res);

    // Admin
    if (url === '/api/admin' && method === 'GET') return handleAdminUsers(req, res);
    if (url === '/api/admin' && method === 'POST') return handleAdminUpdateUser(req, res);

    // Analytics
    if (url === '/api/analytics' && method === 'GET') return handleAnalytics(req, res);

    // API Keys
    if (url === '/api/keys' && method === 'POST') return handleCreateApiKey(req, res);
    if (url === '/api/keys' && method === 'GET') return handleListApiKeys(req, res);

    // Chats
    if (url === '/api/chat' && method === 'POST') return handleCreateChat(req, res);
    if (url === '/api/chat' && method === 'GET') return handleListChats(req, res);
    if (url === '/api/chat/messages' && method === 'GET') return handleGetChat(req, res);
    if (url === '/api/chat/delete' && method === 'POST') return handleDeleteChat(req, res);

    // AI
    if (url === '/api/chat/ai' && method === 'POST') return handleAIChat(req, res);
    if (url === '/api/chat/stream' && method === 'POST') return handleAIChatStream(req, res);

    // Image
    if (url === '/api/image/generate' && method === 'POST') return handleImageGenerate(req, res);

    // Video
    if (url === '/api/video/create' && method === 'POST') return handleVideoCreate(req, res);
    if (url === '/api/video/status' && method === 'GET') return handleVideoStatus(req, res);

    // Feedback
    if (url === '/api/feedback' && method === 'POST') return handleCreateFeedback(req, res);

    // Leaderboard
    if (url === '/api/leaderboard' && method === 'GET') return handleLeaderboard(req, res);

    // Referrals
    if (url === '/api/referrals' && method === 'GET') return handleReferrals(req, res);

    // Health
    if (url === '/api/health' && method === 'GET') {
      return json(res, { status: 'ok', api: 'available', version: '1.0.0', timestamp: new Date().toISOString() });
    }

    // Suggestions
    if (url === '/api/suggestions' && method === 'GET') return handleSuggestions(req, res);

    return json(res, { error: 'API endpoint not found' }, 404);
  } catch (error) {
    return json(res, { error: 'Internal server error: ' + error.message }, 500);
  }
}
