const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function loadProfile() {

    const { data: sessionData } =
        await supabaseClient.auth.getSession();

    const session = sessionData.session;

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    const user = session.user;

    const { data: profile, error } =
        await supabaseClient
            .from("profiles")
            .select("username, display_name")
            .eq("id", user.id)
            .single();

    if (error) {
        console.error("Profile error:", error);
        return;
    }

    document.getElementById("username").textContent =
        profile.username || "-";

    document.getElementById("displayName").textContent =
        profile.display_name || "-";

    document.getElementById("email").textContent =
        user.email;
}

loadProfile();

document.addEventListener("DOMContentLoaded", () => {

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {

            const { error } =
                await supabaseClient.auth.signOut();

            if (error) {
                alert("Gagal logout: " + error.message);
                return;
            }

            window.location.href = "login.html";
        });
    }

});