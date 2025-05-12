const promoteBtns = document.querySelectorAll(".promote");
promoteBtns.forEach(promoteBtn => {
    promoteBtn.addEventListener("click", () => {
        fetch('/changeUserType', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: promoteBtn.name,
                userType: "admin",
            }),
        }).then(() => {
            console.log("User promoted");
            window.location.reload();
        });
    });
});
const demoteBtns = document.querySelectorAll(".demote");
demoteBtns.forEach(demoteBtn => {
    demoteBtn.addEventListener("click", () => {
        fetch('/changeUserType', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: demoteBtn.name,
                userType: "user",
            }),
        }).then(() => {
            console.log("User demoted");
            window.location.reload();
        });

    });
});