Template.DrumMachineBox.onCreated(function(){
  var instance = this;

  // ** 1. SUBSCRIPTIONS ** //
  instance.subscribe('myDrumMachine');

  instance.drumMachine = function(){
    return DrumMachines.findOne();
  };

  // console.log('drum machine box instance: ', instance);

  // ** 2. PRIVATE INTERFACE ** //

  // ** 2.1 INITIAL STATE ** //

  // ** 2.1.1 TIMING CONFIGURATION ** //
  instance.isPlaying = new ReactiveVar(false);
  var lookahead = 20.0;
  var scheduleAheadTime = 0.30;
  var nextNoteTime = 0.0;

  var audioContext = DrumApp.audioContext;

  // ** 2.2 METRONOME WORKER ** //
  metronomeWorker = new Worker("/metronomeworker.js");
  metronomeWorker.postMessage({"interval": lookahead});

  metronomeWorker.onmessage = function(e) {
    if (e.data == "tick") {
      scheduler();
    } else {
      console.log("message: " + e.data);
    }
  };

  // ** 2.3 BEAT/TICK COUNTER ** //
  var counter = new ReactiveDict();
  counter.set({beat: 0, tick: 0, t: 1});

  counter.increment = function() {
    if(this.get('t') >= 16) { 
      this.set({'t': 1});
    } else {
      this.set({'t': this.get('t')+1 });
    }
  };

  counter.reset = function() {
    this.set({'t': 1});
  };

  instance.autorun(function() {
    var ticky = counter.get('t') - 1;
    var beat = Math.floor(ticky/4);
    var tick = ticky % 4;
    counter.set({beat: beat, tick: tick});
  });
  
  // ** 2.4 SCHEDULER ** //

  var scheduler = function() {
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime ) {
      scheduleNotes( nextNoteTime );
      nextNote();
    }
  };

  var triggerCell = function(index, time, velocity) {
    // $($('.kit#'+instance.drumMachine().kitId).find('div.sample-slot')[index])
    $($('div.sample-slot')[index])
      .find('.trigger')
        .trigger(
          'schedule',
          {
            destination: audioContext.destination,
            time: time,
            velocity: velocity
          }
        );
  };

  var scheduleNotes = function(time) {
    _.each(
      instance.drumMachine().measure().beats[counter.get('beat')].ticks[counter.get('tick')].cells,
      function(cell, index) {
        if( cell.velocity>0 ){ triggerCell(index, time, cell.velocity); }
      }
    );
  };

  var nextNote = function() {
    // Advance current note and time by a 16th note...
    var secondsPerBeat = 60.0 / instance.drumMachine().tempo;
    nextNoteTime += 0.25 * secondsPerBeat;
    counter.increment();
  };

  // ** 3. PUBLIC INTERFACE ** //

  instance.play = function() {
    if(! instance.isPlaying.get()) {
      instance.isPlaying.set(true);
      // isPlaying = true;
      var secondsPerBeat = 60.0 / instance.drumMachine().tempo;
      nextNoteTime = audioContext.currentTime + (0.25 * secondsPerBeat);
      metronomeWorker.postMessage("start"); 
    }
  };

  instance.pause = function() {
    metronomeWorker.postMessage("stop");
    instance.isPlaying.set(false);
  };

  instance.stop = function() {
    instance.pause();
    counter.reset();
  };

});