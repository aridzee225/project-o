const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const displayName = document.getElementById("displayName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    registerMessage.textContent = "Membuat akun...";

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        registerMessage.textContent = "Pendaftaran gagal: " + error.message;
        return;
    }

    if (!data.user) {
        registerMessage.textContent = "Pendaftaran gagal. User tidak ditemukan.";
        return;
    }


    registerMessage.textContent =
        "Akun berhasil dibuat! Silakan login.";

    setTimeout(function () {
        window.location.href = "login.html";
    }, 1500);
});