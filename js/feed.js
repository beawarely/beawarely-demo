document.addEventListener("DOMContentLoaded", async () => {
  const overlay = document.getElementById("feed-login-overlay");
  const postBox = document.getElementById("feed-postbox");
  const feedPosts = document.getElementById("feedPosts");
  const tabPublic = document.getElementById("tabPublic");
  const tabFriends = document.getElementById("tabFriends");
  const postBtn = document.getElementById("postSubmit");
  const postInput = document.getElementById("postContent");
  const loginRedirect = document.getElementById("feedLoginRedirect");

  let currentTab = "public";
  let user = null;

  const { data: session } = await supabase.auth.getUser();
  user = session?.user || null;

  if (!user) {
    overlay.style.display = "flex";
    postBox.style.display = "none";
  } else {
    overlay.style.display = "none";
    postBox.style.display = "flex";
    await loadPosts();
  }

  loginRedirect.addEventListener("click", () => {
    document.getElementById("loginBtn").click();
  });

  tabPublic.addEventListener("click", () => switchTab("public"));
  tabFriends.addEventListener("click", () => switchTab("friends"));

  async function switchTab(tab) {
    currentTab = tab;
    tabPublic.classList.toggle("active", tab === "public");
    tabFriends.classList.toggle("active", tab === "friends");
    await loadPosts();
  }

  postBtn.addEventListener("click", async () => {
    const text = postInput.value.trim();
    if (!text) return alert("Write something first.");
    const { error } = await supabase.from("user_posts").insert([
      { author_id: user.id, content: text, visibility: currentTab }
    ]);
    if (error) return alert("❌ " + error.message);
    postInput.value = "";
    await loadPosts();
  });

  supabase
    .channel("feed_updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "user_posts" }, loadPosts)
    .on("postgres_changes", { event: "*", schema: "public", table: "tool_ideas" }, loadPosts)
    .on("postgres_changes", { event: "*", schema: "public", table: "work_experiences" }, loadPosts)
    .subscribe();

  async function loadPosts() {
    if (!feedPosts) return;
    feedPosts.innerHTML = "<p style='opacity:.6;'>Loading...</p>";

    const posts = [];

    // USER POSTS
    if (user) {
      let queryPosts = supabase
        .from("user_posts")
        .select("id, author_id, content, created_at, visibility")
        .order("created_at", { ascending: false });

      queryPosts = currentTab === "friends"
        ? queryPosts.eq("visibility", "friends")
        : queryPosts.eq("visibility", "public");

      const { data: userPosts } = await queryPosts;
      if (userPosts?.length) {
        userPosts.forEach(p => posts.push({
          type: "user_post",
          author_id: p.author_id,
          content: p.content,
          created_at: p.created_at
        }));
      }
    }

    // TOOL IDEAS
    const { data: tools } = await supabase
      .from("tool_ideas")
      .select("id, author, title, details, created_at, status")
      .order("created_at", { ascending: false });

    if (tools?.length) {
      tools.forEach(t => {
        if (t.status === "approved" || (user && t.author === user.id)) {
          posts.push({
            type: "tool_idea",
            author_id: t.author,
            content: `<b>💡 ${escapeHtml(t.title || "Untitled")}</b><br>${escapeHtml(t.details || "")}`,
            created_at: t.created_at
          });
        }
      });
    }

    // WORK EXPERIENCES
    const { data: works } = await supabase
      .from("work_experiences")
      .select("id, author, company, role, content, created_at, status")
      .order("created_at", { ascending: false });

    if (works?.length) {
      works.forEach(w => {
        if (w.status === "approved" || (user && w.author === user.id)) {
          posts.push({
            type: "work_exp",
            author_id: w.author,
            content: `<b>⚖️ ${escapeHtml(w.role || "")}</b> at <i>${escapeHtml(w.company || "")}</i><br>${escapeHtml(w.content || "")}`,
            created_at: w.created_at
          });
        }
      });
    }

    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!posts.length) {
      feedPosts.innerHTML = "<p style='opacity:.6;'>No posts yet.</p>";
      return;
    }

    const ids = [...new Set(posts.map(p => p.author_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids);

    feedPosts.innerHTML = posts.map(p => {
  const author = profiles?.find(pr => pr.id === p.author_id);
  const name = author?.display_name || "Unknown";
  const uid = author?.id || "";
  let avatar = author?.avatar_url;
  if (avatar && !avatar.startsWith("https")) {
    avatar = `https://xzwpqyomqjzmiqsszwkg.supabase.co/storage/v1/object/public${avatar.startsWith('/') ? '' : '/'}${avatar}`;
  }
  avatar = avatar || "images/avatar-default.png";
  const time = new Date(p.created_at).toLocaleString();

  const profileLink = uid ? `user.html?id=${uid}` : "#";

  return `
    <div class="post">
      <div class="post-header">
        <a href="${profileLink}" style="text-decoration:none;color:inherit;">
          <img src="${avatar}" alt="" style="cursor:pointer;">
        </a>
        <div>
          <a href="${profileLink}" style="text-decoration:none;color:inherit;">
            <div class="post-author" style="cursor:pointer;">${name}</div>
          </a>
          <div class="post-time">${time}</div>
        </div>
      </div>
      <div class="post-content">${p.content}</div>
    </div>
  `;
}).join("");
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return str || "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
