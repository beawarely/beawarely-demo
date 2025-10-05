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

  // Check session
  const { data } = await supabase.auth.getUser();
  user = data?.user || null;

  if (!user) {
    overlay.style.display = "flex";
    postBox.style.display = "none";
  } else {
    overlay.style.display = "none";
    postBox.style.display = "flex";
    loadPosts();
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
    loadPosts();
  }

  // Add post
  postBtn.addEventListener("click", async () => {
    const text = postInput.value.trim();
    if (!text) return alert("Write something first.");
    const { error } = await supabase.from("user_posts").insert([
      { author_id: user.id, content: text, visibility: currentTab }
    ]);
    if (error) return alert("❌ " + error.message);
    postInput.value = "";
  });

  // Realtime updates
  supabase
    .channel("user_posts_feed")
    .on("postgres_changes", { event: "*", schema: "public", table: "user_posts" }, loadPosts)
    .subscribe();

  // Load posts
  async function loadPosts() {
    if (!user) return;
    feedPosts.innerHTML = "<p style='opacity:.6;'>Loading...</p>";
    let query = supabase.from("user_posts").select("id, author_id, content, created_at, visibility, likes_count").order("created_at", { ascending: false });

    if (currentTab === "friends") {
      query = query.eq("visibility", "friends");
    } else {
      query = query.eq("visibility", "public");
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      feedPosts.innerHTML = "<p>Error loading posts.</p>";
      return;
    }

    if (!data.length) {
      feedPosts.innerHTML = "<p style='opacity:.6;'>No posts yet.</p>";
      return;
    }

    const ids = data.map(p => p.author_id);
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);

    feedPosts.innerHTML = data.map(post => {
      const author = profiles?.find(p => p.id === post.author_id);
      const name = author?.display_name || "Unknown";
      const avatar = author?.avatar_url || "https://via.placeholder.com/36?text=👤";
      const time = new Date(post.created_at).toLocaleString();
      return `
        <div class="post">
          <div class="post-header">
            <img src="${avatar}" alt="">
            <div>
              <div class="post-author">${name}</div>
              <div class="post-time">${time}</div>
            </div>
          </div>
          <div class="post-content">${post.content}</div>
        </div>
      `;
    }).join("");
  }
});
