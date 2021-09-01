
$(document).ready(function () {
    $("#redirect").click(function () {
        console.log(document.getElementById('transaction').checked);
        var tx = "off";
        var dono = "off";
        var buy = "off"

        if (document.getElementById('dono').checked) {
            dono = "on";
        }

        if (document.getElementById('trans').checked) {
            tx = "on";
        }
        if (document.getElementById('buys').checked) {
            buy = "on";
        }
        window.location = `https://rallytwitchbot.com/auth/twitch/creator?donations=${dono}&transactions=${tx}&buy=${buy}`
    });

});

