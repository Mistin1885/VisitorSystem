

//real-time clock
function startTime(){
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth()-1;
    var day = today.getDate();
    var hh = today.getHours();
    var mm = today.getMinutes();
    var ss = today.getSeconds();
    
    mm = checkTime(mm);
    ss = checkTime(ss);

    var str = year+"/"+month+"/"+day+"  "+hh+":"+mm+":"+ss;
    document.getElementById('clock').innerHTML = str;
    var timeoutId = setTimeout(startTime, 500);
}

function checkTime(i) {
    if(i<10) {
        i = "0" + i;
    }
    return i;
}