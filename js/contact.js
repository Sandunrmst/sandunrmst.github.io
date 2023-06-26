(function (){

    const sURL = 'https://script.google.com/macros/s/AKfycbzmi8lY8eNwCngZzmI8nnIZtLxBSEsKQtrHLDxaAkNIc8_ICabnh08UYlXOTaMSO5p_HQ/exec';
    const form = document.forms['submit-to-google-sheet'];

    const msg = document.getElementById("sent-message");
  
    form.addEventListener('submit', e => {
      e.preventDefault();
      fetch(sURL, { method: 'POST', body: new FormData(form)})
        .then(response => {
          msg.innerHTML = "Message sent successfully! 😊";
          setTimeout(function(){
             msg.innerHTML = "";
          }, 4000);
          form.reset();
        })
        .catch(error => {
          msg.innerHTML = "Sorry, Couldn't send message on this time! 😞";
        });
    });


}());

