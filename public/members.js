const img = document.getElementById("randomImage");
img.src = `/images/${Math.floor(Math.random() * 3)}.jpg`;

const nameForm = document.getElementById("name");
fetch('/getUserName', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
}).then(response => {
    response.json().then(data => {
        nameForm.innerHTML = data.name;
    });
});