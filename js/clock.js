
/*
* Author: RMST
* Version: 2.0
*/

function clock() {
    // Get the current time in Sri Lanka
    const tz = 'Asia/Colombo';
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const diff = now.getTime() - localTime.getTime();
    const currentTime = new Date(now.getTime() - diff);

    // Format the time as a 12-hour time with an AM/PM indicator
    let hours = currentTime.getHours();
    let minutes = currentTime.getMinutes();
    let seconds = currentTime.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours || 12; // the hour '0' should be '12'
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    // Update the contents of the HTML elements to display the time
    document.getElementById('hour').innerHTML = hours;
    document.getElementById('minute').innerHTML = minutes;
    document.getElementById('seconds').innerHTML = seconds;
    document.getElementById('ampm').innerHTML = ampm;
}

// Set up a timer to call the clock function every second
const interval = setInterval(clock, 1000);
