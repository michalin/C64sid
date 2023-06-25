const clkrates = [1000000, 1022727, 985248]; //ESP32,NTSC,PAL
let registers = [44, 17, 0, 8, 16, 0, 240, //voice 1
    160, 21, 0, 8, 16, 0, 240, //voice 2
    177, 25, 0, 8, 16, 0, 240, //voice 3
    0, 0, 0, 15, //Filter
    0, 0, 0, 0]; // Status
const bgcolors = ["magenta", "cyan", "yellow"];
let base = 0;//54272;
let w_prefix = "Register ";
let r_prefix = "Register";
const w_sep = ","
const r_sep = ":"
let _voice = 0;
let _model = 0;
let sustain = [1000, 1000, 1000];
const cmd_read_regs = 40;
const cmd_reset = 41;
const cmd_effect = 42;

let gateway = "ws://sid.local/ws";
let websocket = new WebSocket(gateway);
websocket.onopen = event => {
    console.log('Websocket open');
    sendSocket(41, 0); //Reset the SID
    for (i = 0; i <= 24; i++) //Initialize registers
    {
        sendSocket(i, registers[i]);
    }
}
websocket.onclose = event => { console.log('Websocket closed'); }
websocket.onmessage = event => {
    console.log(event.data);
    let jvalues = JSON.parse(event.data);
    document.getElementById("reg25").innerHTML = jvalues[0];
    document.getElementById("reg26").innerHTML = jvalues[1];
    document.getElementById("reg27").innerHTML = jvalues[2];
    document.getElementById("reg28").innerHTML = jvalues[3];
};
console.log(registers);

/*
/ Helper functions
*/
function sendSocket(regnum, value) {
    if (websocket.readyState == websocket.OPEN) {
        let jreg = { "regnum": regnum, "value": value };
        websocket.send(JSON.stringify(jreg));
    }
}

let poll_interval_hdl;
function poll_regs(x) {
    //console.log("register read "+x);
    if (x.value == "poll") {
        x.value = "stop";
        poll_interval_hdl = setInterval(() => {
            sendSocket(40, 0); //If the ESP receives this, he reads the registers >= 25
        }, 250);
    } else {
        x.value = "poll";
        clearInterval(poll_interval_hdl);
    }
}
function set_regvals01(frequency) { //Write values for frequency registers  
    let model = document.getElementById("model").selectedIndex;
    let reg01 = Math.round(frequency * 2 ** 24 / clkrates[model]);
    //Register 0,7,14 (LO)
    let regnum = _voice * 7;
    registers[regnum] = reg01 & 0xFF;
    document.getElementById("reg0").innerHTML = registers[regnum];
    sendSocket(regnum, registers[regnum]);
    //Register 1,8,15 (Hi)
    regnum = 1 + _voice * 7;
    registers[regnum] = (reg01 >> 8) >= 255 ? 255 : (reg01 >> 8);
    document.getElementById("reg1").innerHTML = registers[regnum];
    sendSocket(regnum, registers[regnum]);
    //console.log(registers);
}

/*
/ Callback functions for UI
*/
function on_frqchange(x) {
    console.log(x.type);
    let frequency = x.value;
    if (x.type == "select-one")
        frequency = Math.round(16.35 * 2 ** (x.selectedIndex / 12));

    if (x.type != "range")
        document.getElementById("sld_frq").value = frequency; //Slider
    if (x.type != "number")
        document.getElementById("inp_freq").value = frequency; //Number fild
    if (x.type != "select-one")
        document.getElementById("note").selectedIndex = 12 * Math.log2(x.value / 16.35); //Note selector

    set_regvals01(frequency);
}
function on_dutychange(x) { //Duty cycle
    //Register 3
    let regnum = 3 + _voice * 7;
    registers[regnum] = x >> 8;
    document.getElementById("reg3").innerHTML = registers[regnum];
    sendSocket(regnum, registers[regnum]);
    //Register 2
    regnum = 2 + _voice * 7
    registers[regnum] = x & 0xff;
    document.getElementById("reg2").innerHTML = registers[regnum];
    sendSocket(regnum, registers[regnum]);
}
function on_wfchange(x) { //Waveform has changed
    //console.log(x);
    let regnum = 4 + _voice * 7;
    if (x.value > 8)  //upper four bits: radio buttons
    {
        registers[regnum] &= 0x0F;
        registers[regnum] += Number(x.value);
    } else //Lower four bits: checkboxes
        registers[regnum] ^= x.value;
    document.getElementById("reg4").innerHTML = registers[4 + _voice * 7];
    sendSocket(regnum, registers[regnum]);
}
function on_adchange(x) { //Attack and decay
    let regnum = 5 + _voice * 7;
    if (x.id == "attack") {
        registers[regnum] = (registers[regnum] & 0x0f) + 16 * x.selectedIndex;
    } else if (x.id == "decay") {
        registers[regnum] = (registers[regnum] & 0xf0) + x.selectedIndex;
    }
    document.getElementById("reg5").innerHTML = registers[regnum];
    sendSocket(regnum, registers[regnum]);
}
function on_srchange(x) { //Sustain and release
    let regnum = 6 + _voice * 7;
    if (x.id == "sustain") {
        registers[regnum] = (registers[regnum] & 0x0f) + 16 * x.value;

    } else {
        registers[regnum] = (registers[regnum] & 0xf0) + x.selectedIndex;
    }
    document.getElementById("reg6").innerHTML = registers[regnum];
    sendSocket(regnum, registers[regnum]);
}
function on_filterFchange(x) { //Filter frequency
    document.getElementsByName("filt_f").forEach(element => {
        element.value = x.value;
    });
    let f = Math.round(2047 * (x.value - 30) / 9970);
    registers[21] = f & 0x07;
    registers[22] = f >> 3;
    document.getElementById("reg21").innerHTML = registers[21];
    document.getElementById("reg22").innerHTML = registers[22];
    sendSocket(21, registers[21]);
    sendSocket(22, registers[22]);
}
function on_filterRchange(x) { //Filter Resonance
    if (x.type == "range") {
        registers[23] &= 0x0F;
        registers[23] |= x.value << 4;
    }
    else //checkbox
        registers[23] ^= x.value;
    document.getElementById("reg23").innerHTML = registers[23];
    sendSocket(23, registers[23]);
}

function on_volumechange(x) { //
    //console.log(x);
    if (x.type == "range") {
        registers[24] &= 0xF0;
        registers[24] |= x.value;
    }
    else  //checkbox
    {
        if (x.value >= 16 && x.value <= 64) //Radio buttons
        {
            registers[24] &= 0x8F;
            registers[24] += Number(x.value);
        } else
            registers[24] ^= x.value;
    }
    document.getElementById("reg24").innerHTML = registers[24];
    sendSocket(24, registers[24]);
}

function on_effect(x) {
    let selected = { "effect": 0, "strength": 0 };
    document.getElementsByName("effects").forEach((element, key) => {
        if (element.checked)
            selected.effect = element.value;
    });
    selected.strength = document.getElementById("chk_effect_sld").value;
    //console.log(selected);
    sendSocket(cmd_effect, selected);
}

function on_btn_play() {
    const sus = document.getElementsByName("sustain");
    for (let voice = 0; voice < 3; voice++) {
        let enabled = sus[2 * voice + 1].checked;
        let sus_t = sus[2 * voice].value;
        if (document.getElementById("sus_lock").checked)
            sus_t = sus[0].value;

        if (enabled) {
            let regnum = 7 * voice + 4;
            registers[regnum] |= 1; //Set gate bit
            if (voice == _voice) {
                document.getElementById("reg4_b0").checked = 1;
                document.getElementById("reg4").innerHTML = registers[regnum];
                document.getElementById("reg4_b0").checked = true;
            }
            sendSocket(regnum, registers[regnum]);
            setTimeout(() => {
                registers[regnum] &= 0xFE; //Set gate bit
                document.getElementById("reg4").innerHTML = registers[regnum];
                document.getElementById("reg4_b0").checked = false;
                sendSocket(regnum, registers[regnum]);
            }, sus_t);

        }
    }
}

/*
/ Initialization of fields
*/
const attacks = ["2 ms", "8 ms", "16 ms", "24 ms", "38 ms", "56 ms", "68 ms", "80 ms", "100 ms", "250 ms", "500 ms", "800 ms", "1s", "3s", "5s", "8s"];
attacks.forEach(element => {
    var option = document.createElement("option");
    option.text = element;
    document.getElementById("attack").add(option);
});
const decays = ["8 ms", "24 ms", "48 ms", "72 ms", "114 ms", "168 ms", "204 ms", "240 ms", "300 ms", "750 ms", "1500 ms", "2400 ms", "3s", "9s", "15s", "24s"];
decays.forEach(element => {
    var option = document.createElement("option");
    option.text = element;
    document.getElementById("decay").add(option);
});
var releases = decays;
releases.forEach(element => {
    var option = document.createElement("option");
    option.text = element;
    document.getElementById("release").add(option);
});

const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
for (octave = 0; octave <= 7; octave++) {
    notes.forEach(note => {
        var option = document.createElement("option");
        option.text = octave + "-" + note;
        document.getElementById("note").add(option);
    });
}


function set_voice_field(voice) { /* Sets the voice fields according to register content */
    //console.log("-->set_voice_field(" + voice + ")");
    _voice = voice;
    //set labels
    const labels = document.getElementsByName("l_reg")
    for (i = 0; i < labels.length; i++) {
        const regnum = Number(labels[i].id.replace(/[^0-9]/g, ""));
        if (regnum < 21) //voice register
            labels[i].innerHTML = w_prefix + (base + _voice * 7 + regnum) + w_sep;
    }

    document.getElementById("voices").style.backgroundColor = bgcolors[voice];
    // Init frequency controls from register 0 and 1
    var reg01 = registers[1 + voice * 7] * 256 + registers[voice * 7];
    var freq = Math.round(reg01 * clkrates[_model] / 2 ** 24);
    document.getElementById("sld_frq").value = freq; //Frequency slider
    document.getElementById("inp_freq").value = freq; //Frequency input field
    document.getElementById("note").selectedIndex = 12 * Math.log2(freq / 16.35); //Note selector from frequency
    document.getElementById("reg0").innerHTML = registers[0 + voice * 7];
    document.getElementById("reg1").innerHTML = registers[1 + voice * 7];
    //Init duty cycle controls from register 2 and 3
    document.getElementById("duty").value = 256 * registers[3 + voice * 7] + registers[2 + voice * 7];
    document.getElementById("reg2").innerHTML = registers[2 + voice * 7];
    document.getElementById("reg3").innerHTML = registers[3 + voice * 7];
    //Init waveform checkboxes from register 4
    document.getElementsByName("waveform").forEach(function (element, index) {
        var reg4 = registers[4 + voice * 7];
        element.checked = ((reg4 << index) & 128);
    });
    document.getElementById("reg4").innerHTML = registers[4 + voice * 7];
    if (voice >= 1)
        document.getElementById("r4b1_2").hidden = true;
    else
        document.getElementById("r4b1_2").hidden = false;
    //Init Attack and Decay selectors from register 5H and 5L
    document.getElementById("attack").selectedIndex = registers[5 + voice * 7] / 16;
    document.getElementById("decay").selectedIndex = registers[5 + voice * 7] & 0x0f;
    document.getElementById("reg5").innerHTML = registers[5 + voice * 7];
    //Init Sustain level slider and release selector from register 6H and 6L
    document.getElementById("sustain").value = registers[6 + voice * 7] / 16;
    document.getElementById("release").selectedIndex = registers[6 + voice * 7] & 0x0f;
    document.getElementById("reg6").innerHTML = registers[6 + voice * 7];
}

function set_filter_field() { /* Sets the filter fields according to register content */
    //set labels
    const labels = document.getElementsByName("l_reg")
    for (i = 0; i < labels.length; i++) {
        const regnum = Number(labels[i].id.replace(/[^0-9]/g, ""));
        if (regnum >= 21) //status register
            labels[i].innerHTML = w_prefix + (base + regnum) + w_sep;
        if (regnum >= 25 && _model == 0)  //Status register  
            labels[i].innerHTML = r_prefix + (base + regnum) + r_sep;
        if (regnum >= 25 && _model != 0)  //Status register  
            labels[i].innerHTML = r_prefix + (base + regnum)
    }

    document.getElementById("filterF_num").value = Math.round((8 * registers[22] + registers[21]) / 2047 * 9970 + 30);
    document.getElementById("filterF_range").value = (8 * registers[22] + registers[21]) / 2047 * 9970 + 30;
    document.getElementById("reg21").innerHTML = registers[21];
    document.getElementById("reg22").innerHTML = registers[22];
    document.getElementsByName("f_enable").forEach((element, index) => {
        element.checked = ((registers[23] << index) & 8);
    });
    document.getElementById("reg23").innerHTML = registers[23];
    document.getElementById("filterR_range").value = (registers[23] & 0xF0) >> 4;
    document.getElementsByName("pass").forEach((element, index) => {
        element.checked = ((registers[24] << index) & 128);
    });
    document.getElementById("volume").value = registers[24] & 0x0F;
    document.getElementById("reg24").innerHTML = registers[24];

    document.getElementById("chk_effect_off").checked = "1";
}

function set_model(model) {
    _model = model;
    if (model > 0) //C64
    {
        w_prefix = "Poke ";
        r_prefix = "Peek ";
        base = 54272;
        document.getElementById("software").hidden = true;
        document.getElementById("poll").hidden = true;
        document.getElementsByName("rdreg").forEach((x)=>{
            x.innerHTML="";
        });
    } else {
        w_prefix = "Reg. ";
        r_prefix = "Reg. ";
        base = 0;
        document.getElementById("software").hidden = false;
        document.getElementById("poll").hidden = false;
        document.getElementsByName("rdreg").forEach((x)=>{
            x.innerHTML="0";
        });
    }
    set_voice_field(_voice)
    set_filter_field();
}
let h = document.querySelectorAll('input[type="range"]').forEach((element, index) => {
    element.value = 0;
});
document.getElementById("model").selectedIndex = 0;
document.getElementById("voice").selectedIndex = 0;
//for(i=0; i<=24;i++)

set_model(_model);


