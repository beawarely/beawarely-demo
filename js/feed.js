// Diagnostic verbose feed loader for BeAwarely
// Replaces js/feed.js — extensive console logging + UI error messages
document.addEventListener("DOMContentLoaded", async () => {
  console.log("FEED DEBUG: js/feed.js START");

  const overlay = document.getElementById("feed-login-overlay");
  const postBox = document.getElementById("feed-postbox");
  const feedPosts = document.getElementById("feedPosts");
  const tabPublic = document.getElementById("tabPublic");
  const tabFriends = document.getElementById("tabFriends");
  const postBtn = document.getElementById("postSubmit");
  const postInput = document.getElementById("postContent");
  const loginRedirect = document.getElementById("feedLoginRedirect");

  if (!feedPosts) {
    console.error("FEED DEBUG: #feedPosts element NOT FOUND");
    return;
  }

  // Helper to show a prominent debug message in the feed UI
  function showFeedMessage(html) {
    feedPosts.innerHTML = `<div class="post"><div style="color:#f66;font-weight:700;">${html}</div></div>`;
  }

  // Safe wrapper for async ops with UI feedback
  async function safe(fn, label) {
    try {
      console.log(`FEED DEBUG: start ${label}`);
      const r = await fn();
      console.log(`FEED DEBUG: ok ${label}`, r);
      return [null, r];
    } catch (e) {
      console.error(`FEED DEBUG: error ${label}:`, e);
      return [e, null];
    }
  }

  let currentTab = "public";
  let user = null;

  // Check session
  const [userErr, userResp] = await safe(() => supabase.auth.getUser(), "supabase.auth.getUser()");
  if (userErr) {
    showFeedMessage("Supabase auth error. See console for details.");
    return;
  }
  const session = userResp?.data || userResp; // supabase v2 sometimes nests
  user = session?.user || null;
  console.log("FEED DEBUG: current user:", user ? { id: user.id, email: user.email } : null);

  if (!user) {
    if (overlay) overlay.style.display = "flex";
    if (postBox) postBox.style.display = "none";
    // still try to load approved public items (for anonymous view) — if you want hide, adjust
    // but per your logic, anonymous sees nothing for user_posts; we will still show approved tool/work items
  } else {
    if (overlay) overlay.style.display = "none";
    if (postBox) postBox.style.display = "flex";
  }

  loginRedirect?.addEventListener("click", () => {
    document.getElementById("loginBtn")?.click();
  });

  tabPublic?.addEventListener("click", () => switchTab("public"));
  tabFriends?.addEventListener("click", () => switchTab("friends"));

  async function switchTab(tab) {
    currentTab = tab;
    tabPublic?.classList.toggle("active", tab === "public");
    tabFriends?.classList.toggle("active", tab === "friends");
    await loadPosts();
  }

  // Add post (only for logged-in users)
  if (postBtn) {
    postBtn.addEventListener("click", async () => {
      if (!user) return alert("Log in first.");
      const text = postInput.value.trim();
      if (!text) return alert("Write something first.");
      const [err, resp] = await safe(() => supabase.from("user_posts").insert([
        { author_id: user.id, content: text, visibility: currentTab }
      ]), "insert user_posts");
      if (err) {
        alert("❌ " + (err?.message || "Insert failed"));
        return;
      }
      postInput.value = "";
      await loadPosts();
    });
  } else {
    console.warn("FEED DEBUG: postBtn not found");
  }

  // Realtime: subscribe to three tables
  try {
    supabase
      .channel("feed_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_posts" }, () => {
        console.log("FEED DEBUG: realtime user_posts event");
        loadPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tool_ideas" }, () => {
        console.log("FEED DEBUG: realtime tool_ideas event");
        loadPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "work_experiences" }, () => {
        console.log("FEED DEBUG: realtime work_experiences event");
        loadPosts();
      })
      .subscribe();
    console.log("FEED DEBUG: realtime subscribed");
  } catch (e) {
    console.warn("FEED DEBUG: realtime subscribe failed:", e);
  }

  // Main loader
  async function loadPosts() {
    try {
      console.log("FEED DEBUG: loadPosts() start — currentTab:", currentTab, "user:", user?.id);
      feedPosts.innerHTML = "<p style='opacity:.6;'>Loading...</p>";

      const posts = [];

      // 1) user_posts (only visible to logged-in users per visibility)
      if (user) {
        const q1 = supabase
          .from("user_posts")
          .select("id, author_id, content, created_at, visibility")
          .order("created_at", { ascending: false });

        if (currentTab === "friends") q1.eq("visibility", "friends");
        else q1.eq("visibility", "public");

        const [err1, resp1] = await safe(() => q1, "select user_posts");
        if (err1) {
          // If RLS blocks reading user_posts for anon, we'll log it and continue
          console.error("FEED DEBUG: user_posts read error - continuing", err1);
        } else {
          const userPosts = resp1?.data ?? resp1;
          console.log("FEED DEBUG: user_posts count:", (userPosts && userPosts.length) || 0);
          if (userPosts && userPosts.length) {
            for (const p of userPosts) {
              posts.push({
                type: "user_post",
                author_id: p.author_id,
                content: p.content,
                created_at: p.created_at
              });
            }
          }
        }
      } else {
        console.log("FEED DEBUG: not logged in — skipping user_posts fetch for private entries");
      }

      // 2) tool_ideas (only approved OR author==user)
      const [err2, resp2] = await safe(() => supabase
        .from("tool_ideas")
        .select("id, author, title, details, created_at, status")
        .order("created_at", { ascending: false }), "select tool_ideas");

      if (err2) {
        console.error("FEED DEBUG: tool_ideas read error:", err2);
        // show but continue
      } else {
        const tools = resp2?.data ?? resp2;
        console.log("FEED DEBUG: tool_ideas count:", (tools && tools.length) || 0);
        if (tools && tools.length) {
          for (const t of tools) {
            if (t.status === "approved" || (user && t.author === user.id)) {
              posts.push({
                type: "tool_idea",
                author_id: t.author,
                content: `<b>💡 ${escapeHtml(t.title || "Untitled")}</b><br>${escapeHtml(t.details || "")}`,
                created_at: t.created_at
              });
            } else {
              // not approved and not owner -> skip
            }
          }
        }
      }

      // 3) work_experiences (only approved OR author==user)
      const [err3, resp3] = await safe(() => supabase
        .from("work_experiences")
        .select("id, author, company, role, content, created_at, status")
        .order("created_at", { ascending: false }), "select work_experiences");

      if (err3) {
        console.error("FEED DEBUG: work_experiences read error:", err3);
      } else {
        const works = resp3?.data ?? resp3;
        console.log("FEED DEBUG: work_experiences count:", (works && works.length) || 0);
        if (works && works.length) {
          for (const w of works) {
            if (w.status === "approved" || (user && w.author === user.id)) {
              posts.push({
                type: "work_exp",
                author_id: w.author,
                content: `<b>⚖️ ${escapeHtml(w.role || '')}</b> at <i>${escapeHtml(w.company || '')}</i><br>${escapeHtml(w.content || '')}`,
                created_at: w.created_at
              });
            }
          }
        }
      }

      // Sort combined posts by created_at desc
      posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      console.log("FEED DEBUG: combined posts total:", posts.length);

      if (!posts.length) {
        feedPosts.innerHTML = "<p style='opacity:.6;'>No posts yet.</p>";
        return;
      }

      // Fetch author profiles
      const ids = [...new Set(posts.map(p => p.author_id).filter(Boolean))];
      console.log("FEED DEBUG: unique author ids:", ids);
      let profiles = [];
      if (ids.length) {
        const [errP, respP] = await safe(() => supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", ids), "select profiles");
        if (errP) {
          console.error("FEED DEBUG: profiles read error:", errP);
        } else {
          profiles = respP?.data ?? respP;
          console.log("FEED DEBUG: profiles fetched:", (profiles && profiles.length) || 0);
        }
      } else {
        console.log("FEED DEBUG: no author ids to fetch profiles for");
      }

      // Render posts (escape content already applied)
      feedPosts.innerHTML = posts.map(p => {
        const author = profiles.find(pr => pr.id === p.author_id) || {};
        const name = author.display_name || "Unknown";
        const avatar = author.avatar_url ? normalizeAvatarUrl(author.avatar_url) : "https://via.placeholder.com/36?text=👤";
        const time = p.created_at ? new Date(p.created_at).toLocaleString() : "";
        return `
          <div class="post">
            <div class="post-header">
              <img src="${avatar}" alt="">
              <div>
                <div class="post-author">${escapeHtml(name)}</div>
                <div class="post-time">${escapeHtml(time)}</div>
              </div>
            </div>
            <div class="post-content">${p.content}</div>
          </div>
        `;
      }).join("");

    } catch (e) {
      console.error("FEED DEBUG: loadPosts fatal error:", e);
      showFeedMessage("Feed load failed — check console for details.");
    }
  }

  // Helpers
  function escapeHtml(str) {
    if (typeof str !== "string") return str || "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function normalizeAvatarUrl(url) {
    if (!url) return url;
    if (url.startsWith("http")) return url;
    // try to normalize Supabase storage paths that may be stored without full URL
    return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // expose for manual debugging in console
  window.FEED_DEBUG = {
    loadPosts,
    supabase,
  };

  // initial load
  await loadPosts();
});
