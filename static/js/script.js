$('document').ready(function() {

    var socket = io();

    socket.emit('fetch_room_list_server');

    socket.on('update_room_list_client', function(result) {
        console.log(result.data);
        let dom_room_list = '';
        let object_room_keys = Object.keys(result.data.rooms);
        for (let i=0; i<object_room_keys.length; i++) {
            if (result.data.rooms[object_room_keys[i]].users.length < 1) {
                dom_room_list += '<li><a class="room-link" href="/'+object_room_keys[i]+'">'+object_room_keys[i]+'</a></li>';
            }
        }
        $('#room-list').html(dom_room_list);
    });

    $(document).on('click', '.room-link', function() {
        socket.emit('fetch_room_list_server');
    });

    $('#create-room').on('click', function() {
        $.get($(this).attr('href'), $(this).serialize(), function(result) {
            socket.emit('fetch_room_list_server');
        });
        return false; 
    });

});