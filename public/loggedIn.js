const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", e => {
    fetch("/logout", {
        method: "POST",
    })
        .then(response => {
            window.location.reload();
        })
        .catch(error => {
            console.error("Error:", error);
        });
});