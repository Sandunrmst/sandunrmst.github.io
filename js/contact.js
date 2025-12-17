(function () {

  const sURL = "https://script.google.com/macros/s/AKfycbz9x4rGiI-aGIISODJYa0EH6Hp1bVTHWZMZcuxZfjgx2eQFHnjG4kw-t2uucS_Yj_rx/exec";
  const form = document.forms['submit-to-google-sheet'];
  const msg = document.getElementById("sent-message");
  const loader = document.getElementById("message-loader");

  form.addEventListener('submit', e => {
    e.preventDefault();

    loader.className = "show-message";

    fetch(sURL, {
      method: 'POST',
      body: new FormData(form)
    })
      .then(res => res.json())
      .then(data => {
        loader.className = "hide-message";

        if (data.result === "success") {
          msg.innerHTML = "Message sent successfully! 😊";
          form.reset();
        } else {
          throw new Error("Server error");
        }

        setTimeout(() => msg.innerHTML = "", 3000);
      })
      .catch(err => {
        loader.className = "hide-message";
        msg.innerHTML = "Sorry, couldn't send message 😞";
      });
  });

}());

