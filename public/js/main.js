var eventQueue = [];
var svg;
var element;
var drawingArea;
var width;
var height;
var volume = 0.6;
var orgRepoFilterNames = [];
var header = $('header');

var scale_factor = 6,
    note_overlap = 2,
    note_timeout = 300,
    current_notes = 0,
    max_life = 20000;

var svg_background_color_online  = 'black',
    svg_background_color_offline = 'black',
    svg_text_color               = '#FFFFFF',
    edit_color                   = '#FFFFFF',
    total_sounds = 51;

var celesta = [],
    clav = [],
    swells = [],
    all_loaded = false;

var protocol = 'ws://';

if (window.location.protocol === "https:") {
    protocol = 'wss://';
}

var socket = new WebSocket(protocol + window.location.host + '/ws');

socket.addEventListener("message", function (data) {
    var json = JSON.parse(data.data);

    if (json.hasOwnProperty('connectedUsers')) {
        $('.online-users-count').html(json.connectedUsers);

        return;
    }

    json.forEach(function (event) {
        if (!isEventInQueue(event)) {
            // Filter out events only specified by the user
            if (orgRepoFilterNames != []) {
                // Don't consider pushes to github.io repos when org filter is on
                if (new RegExp(orgRepoFilterNames.join("|")).test(event.repoName) && event.repoName.indexOf('github.io') == -1) {
                    eventQueue.push(event);
                }
            } else {
                eventQueue.push(event);
            }
        }
    });

    // Don't let the eventQueue grow more than 1000
    if (eventQueue.length > 1000) eventQueue = eventQueue.slice(0, 1000);
});

socket.onopen = function(e){
    $('svg').css('background-color', svg_background_color_online);
    header.css('background-color', svg_background_color_online);
    $('.offline-text').css('visibility', 'hidden');
    $('.events-remaining-text').css('visibility', 'visible');
    $('.events-remaining-value').css('visibility', 'visible');
    $('.online-users-div').css('visibility', 'visible');
};

socket.onclose = function(e){
    $('svg').css('background-color', svg_background_color_offline);
    header.css('background-color', svg_background_color_offline);
    $('.offline-text').css('visibility', 'visible');
    $('.events-remaining-text').css('visibility', 'visible');
    $('.events-remaining-value').css('visibility', 'visible');
};

socket.onerror = function(e){
    $('svg').css('background-color', svg_background_color_offline);
    header.css('background-color', svg_background_color_offline);
    $('.offline-text').css('visibility', 'visible');
    $('.events-remaining-text').css('visibility', 'visible');
    $('.events-remaining-value').css('visibility', 'visible');
};

/**
* This function checks whether an event is already in the queue
*/
function isEventInQueue(event){
  for(var i=0; i<eventQueue.length; i++){
    if(eventQueue[i].id == event.id)
      return true;
  }
  return false;
}

$(function(){
  element = document.documentElement;
  drawingArea = document.getElementsByTagName('#area')[0];
  width  = window.innerWidth || element.clientWidth || drawingArea.clientWidth;
  height = (window.innerHeight - header.height()) || (element.clientHeight - header.height()) || (drawingArea.clientHeight - header.height());
  $('svg').css('background-color', svg_background_color_online);
  header.css('background-color', svg_background_color_online);
  $('svg text').css('color', svg_text_color);
  $('#volumeSlider').slider({
    'max': 100,
    'min': 0,
    'value': volume*100,
    'slide' : function(event, ui){
      volume = ui.value/100.0;
      Howler.volume(volume);
    },
    'change' : function(event, ui){
      volume = ui.value/100.0;
      Howler.volume(volume);
    }
  });

  // Main drawing area
  svg = d3.select("#area").append("svg");
  svg.attr({width: width, height: height});
  svg.style('background-color', svg_background_color_online);

  // For window resizes
  var update_window = function() {
      width  = window.innerWidth || element.clientWidth || drawingArea.clientWidth;
      height = (window.innerHeight - header.height()) || (element.clientHeight - header.height()) || (drawingArea.clientHeight - header.height());
      svg.attr("width", width).attr("height", height);
  };
  window.onresize = update_window;
  update_window();

  var loaded_sounds = 0;
  var sound_load = function(r) {
      loaded_sounds += 1;
      if (loaded_sounds == total_sounds) {
          all_loaded = true;
          setTimeout(playFromQueueExchange1, Math.floor(Math.random() * 1000));
      }
  };

  // Load sounds
  for (var i = 1; i <= 24; i++) {
      if (i > 9) {
          fn = 'c0' + i;
      } else {
          fn = 'c00' + i;
      }
      celesta.push(new Howl({
          src : [
              'https://d1fz9d31zqor6x.cloudfront.net/sounds/celesta/' + fn + '.ogg',
              'https://d1fz9d31zqor6x.cloudfront.net/sounds/celesta/' + fn + '.mp3'
          ],
          volume : 0.7,
          onload : sound_load(),
          buffer: true
      }));
      clav.push(new Howl({
          src : [
              'https://d1fz9d31zqor6x.cloudfront.net/sounds/clav/' + fn + '.ogg',
              'https://d1fz9d31zqor6x.cloudfront.net/sounds/clav/' + fn + '.mp3'
          ],
          volume : 0.4,
          onload : sound_load(),
          buffer: true
      }))
  }

  for (var i = 1; i <= 3; i++) {
      swells.push(new Howl({
          src : [
              'https://d1fz9d31zqor6x.cloudfront.net/sounds/swells/swell' + i + '.ogg', 
              'https://d1fz9d31zqor6x.cloudfront.net/sounds/swells/swell' + i + '.mp3'
          ],
          volume : 1,
          onload : sound_load(),
          buffer: true
      }));
  }

  Howler.volume(volume);

  // Make header and footer visible
  $('body').css('visibility', 'visible');

  $('#org-repo-filter-name').on('input', function() {
    orgRepoFilterNames = $('#org-repo-filter-name').val().split(' ');
    eventQueue = [];
  });

});

/**
* Randomly selects a swell sound and plays it
*/
function playRandomSwell() {
    var index = Math.round(Math.random() * (swells.length - 1));
    swells[index].play();
}

/**
* Plays a sound(celesta and clav) based on passed parameters
*/
function playSound(size, type) {
    var max_pitch = 100.0;
    var log_used = 1.0715307808111486871978099;
    var pitch = 100 - Math.min(max_pitch, Math.log(size + log_used) / Math.log(log_used));
    var index = Math.floor(pitch / 100.0 * Object.keys(celesta).length);
    
    index += Math.floor(Math.random() * 4) - 2;
    index = Math.min(Object.keys(celesta).length - 1, index);
    index = Math.max(1, index);
    if (current_notes < note_overlap) {
        current_notes++;
        if (type == 'IssuesEvent' || type == 'IssueCommentEvent') {
            clav[index].play();
        } else if(type == 'PushEvent') {
            celesta[index].play();
        }else{
          playRandomSwell();
        }
        setTimeout(function() {
            current_notes--;
        }, note_timeout);
    }
}

// Following are the n numbers of event consumers
// consuming n events each per second with a random delay between them

function playFromQueueExchange1(){
  var event = eventQueue.shift();
  if(event != null && event.message != null && svg != null){
    playSound(event.message.length*1.1, event.type);
    if(!document.hidden)
      drawEvent(event, svg);
  }
  setTimeout(playFromQueueExchange1, Math.floor(Math.random() * 1000) + 500);
  $('.events-remaining-value').html(eventQueue.length);
}

// This method capitalizes the string in place
String.prototype.capitalize = function(all){
    if(all){
      return this.split(' ').map(function(e){
        return e.capitalize().join(' ');
      });
    }else{
         return this.charAt(0).toUpperCase() + this.slice(1);
    }
};

function drawEvent(data, svg_area) {
    var starting_opacity = 1;
    var opacity = 1 / (100 / data.message.length);
    if (opacity > 0.5) opacity = 0.5;

    var size = data.message.length;
    var label_text;
    var ring_radius = 80;
    var ring_anim_duration = 3000;
    svg_text_color = '#FFFFFF';

    switch(data.type){
      case "PushEvent":
        label_text = data.actorName.capitalize() + " pushed to " + data.repoName;
        edit_color = '#22B65D';
      break;
      case "PullRequestEvent":
        label_text = data.actorName.capitalize() + " " +
          data.action + " " + " a PR for " + data.repoName;
          edit_color = '#8F19BB';
          ring_anim_duration = 10000;
          ring_radius = 600;
      break;
      case "IssuesEvent":
        label_text = data.actorName.capitalize() + " " +
          data.action + " an issue in " + data.repoName;
          edit_color = '#ADD913';
      break;
      case "IssueCommentEvent":
        label_text = data.actorName.capitalize() + " commented in " + data.repoName;
        edit_color = '#FF4901';
      break;
      case "ForkEvent":
        label_text = data.actorName.capitalize() + " forked " + data.repoName;
        edit_color = '#0184FF';
        break;
      case "CreateEvent":
        label_text = data.actorName.capitalize() + " created " + data.repoName;
        edit_color = '#00C0C0';
      break;
      case "WatchEvent":
        label_text = data.actorName.capitalize() + " watched " + data.repoName;
        edit_color = '#E60062';
      break;
    }

    var no_label = false;
    var type = data.type;

    var abs_size = Math.abs(size);
    size = Math.max(Math.sqrt(abs_size) * scale_factor, 3);

    Math.seedrandom(data.message);
    var x = Math.random() * (width - size) + size;
    var y = Math.random() * (height - size) + size;

    var circle_group = svg_area.append('g')
        .attr('transform', 'translate(' + x + ', ' + y + ')')
        .attr('fill', edit_color)
        .style('opacity', starting_opacity);

    var ring = circle_group.append('circle');
    ring.attr({r: size, stroke: 'none'});
    ring.transition()
        .attr('r', size + ring_radius)
        .style('opacity', 0)
        .ease(Math.sqrt)
        .duration(ring_anim_duration)
        .remove();

    var circle_container = circle_group.append('a');
    circle_container.attr('xlink:href', data.eventURL);
    circle_container.attr('target', '_blank');
    circle_container.attr('fill', svg_text_color);

    var circle = circle_container.append('circle');
    circle.classed(type, true);
    circle.attr('r', size)
      .attr('fill', edit_color)
      .transition()
      .duration(max_life)
      .style('opacity', 0)
      .remove();

    circle_container.on('mouseover', function() {
      circle_container.append('text')
          .text(label_text)
          .classed('label', true)
          .attr('text-anchor', 'middle')
          .attr('font-size', '0.8em')
          .transition()
          .delay(1000)
          .style('opacity', 0)
          .duration(2000)
          .each(function() { no_label = true; })
          .remove();
    });

    var text = circle_container.append('text')
        .text(label_text)
        .classed('article-label', true)
        .attr('text-anchor', 'middle')
        .attr('font-size', '0.8em')
        .transition()
        .delay(2000)
        .style('opacity', 0)
        .duration(5000)
        .each(function() { no_label = true; })
        .remove();

  // Remove HTML of decayed events
  // Keep it less than 50
  if($('#area svg g').length > 50){
    $('#area svg g:lt(10)').remove();
  }
}
