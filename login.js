const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginMessage.textContent = "Sedang login...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        loginMessage.textContent = "Login gagal: " + error.message;
        return;
    }

    const user = data.user;

const displayName =
    user.user_metadata?.display_name ||
    user.email.split("@")[0];

const { error: profileError } = await supabaseClient
    .from("profiles")
    .upsert({
        id: user.id,
        username: displayName,
        display_name: displayName
    });

if (profileError) {
    console.error("Profile error:", profileError);
    loginMessage.textContent =
        "Login berhasil, tetapi profil gagal disimpan.";
    return;
}

loginMessage.textContent = "Login berhasil!";

setTimeout(function () {
    window.location.href = "index.html";
}, 500);

});