
/*
* Author: RMST
* Version: 2.0
*/

function clock(){
    let hour = document.getElementById('hour');
    let minute = document.getElementById('minute');
    let seconds = document.getElementById('seconds');
    let ampm = document.getElementById('ampm');

    //New Zealand Time display
    tz='Asia/Colombo';
    let str=new Date().toLocaleString("en-LK",{timeZone:tz,timeZoneName:"short"});
    let dt2 = new Date();
    let str2 = new Date(dt2.toLocaleString('en-US',{timeZone: tz}));
    
    let diff= dt2.getTime()-str2.getTime();
    let dt3=new Date(dt2.getTime()-diff);
    
    let h= dt3.getHours();
    let m= dt3.getMinutes();
    let s= dt3.getSeconds();
    
    
//                let h= new Date().getHours();
//                let m= new Date().getMinutes();
//                let s= new Date().getSeconds();
    var am= 'AM';
    
    //Convert 24 hour time to 12 hour format with AM PM Indicator
    if(h>12){
        h = h - 12;
        var am = "PM";
    }
    
    // Add 0 to the begining of number if less than 10
    h = ( h < 10 ) ? '0' + h : h;
    m = ( m < 10 ) ? '0' + m : m;
    s = ( s < 10 ) ? '0' + s : s;
    
    hour.innerHTML = h;
    minute.innerHTML = m;
    seconds.innerHTML = s; 
    ampm.innerHTML = am;
}

var interval = setInterval(clock, 1000);