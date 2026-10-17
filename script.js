document.addEventListener("DOMContentLoaded", function () {

    const menuToggle = document.getElementById("menuToggle");
    const menuDropdown = document.getElementById("menuDropdown");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!menuToggle || !menuDropdown) {
        return;
    }

    // MENU
    menuToggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        menuDropdown.classList.toggle("show");
    });

    // Jangan tutup ketika klik isi dropdown
    menuDropdown.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    // Tutup jika klik di luar
    document.addEventListener("click", function () {
        menuDropdown.classList.remove("show");
    });

    // LOGOUT
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async function (event) {

            event.preventDefault();
            event.stopPropagation();

            const supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY
            );

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