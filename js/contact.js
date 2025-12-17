(function () {

  const sURL = 'https://script.google.com/macros/s/AKfycbxyiqjbK58lP4xz53GnV6EdrVE8hsszG0k3FOeypIdiDM6Hdj8NBK6gl_WmYF6REWVaPw/exec';
  const form = document.forms['submit-to-google-sheet'];

  const msg = document.getElementById("sent-message");


  form.addEventListener('submit', e => {
    e.preventDefault();

    document.getElementById('message-loader').className = "show-message";
    document.getElementById('message-loader').innerHTML = '<div class="preloader-sendMail"><div class="loading-dot"></div></div>';

    fetch(sURL, { method: 'POST', body: new FormData(form) })
      .then(res => res.json())
      .then(data => {
        document.getElementById('message-loader').className = "hide-message";

        if (data.result === "success") {
          msg.innerHTML = "Message sent successfully! 😊";
          form.reset();
        } else {
          throw new Error("Script error");
        }

        setTimeout(() => msg.innerHTML = "", 2000);
      })
      .catch(() => {
        document.getElementById('message-loader').className = "hide-message";
        msg.innerHTML = "Sorry, couldn't send message 😞";
      });
  });


}());

