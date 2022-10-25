const express = require('express');
const app = express();
const server = app.listen(8000);
const io = require('socket.io')(server);

/***
 * Use Express Static | For static contents
 */
app.use(express.static(__dirname + '/static'));

/***
 * Set views EJS and Default view-templating engine
 */
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

/***
 * `Room` variable | Left empty by default 
 */
var rooms = {};

/***
 * Setting this up for newly created `room`
 */
var room_count = 0;

/***
 * Function in creating a random hexcode | Used in creating a new character
 */
function random_color() {
    const rgb = ['a','b','c','d','e','f','0','1','2','3','4','5','6','7','8','9'];
    let color = '#'
    for(var i=0; i<6; i++) {
         let x = Math.floor((Math.random()*16));
         color += rgb[x]; 
    }
    return color;
}

/***
 * Setting up Socket.IO | Whenever a socket is created on the client
 */
io.on('connection', function(socket) {

    var room_name_dc;

    /***
     * Socket Listener when `fetch_room_list_server` is initialized by the client. 
     * Template: Homepage
     */
    socket.on('fetch_room_list_server', function() {
        /***
         * Create an emit to the client
         */
        socket.emit('update_room_list_client', {data: {rooms}});
        socket.broadcast.emit('update_room_list_client', {data: {rooms}});
    });

    /***
     * Socket Listener when `new_user_joined_room_server` is initialized by the client.
     */
    socket.on('new_user_joined_room_server', function(data) {
        /***
         * Join the client (socket.id) in a specific room (data.room_name) | This is a constant variable on the client template
         */
        socket.join(data.room_name);

        socket.emit('obtain_socket_id_client', {data: socket.id});

        //This is for if someone disconnected on the room. Identify the room and pass it on the room_name_dc variable. You can find this on the `disconnect` event of socket.
        room_name_dc = data.room_name;

        let new_player = {}; 
        new_player['name'] = socket.id;
        new_player['color'] = random_color();
        
        rooms[data.room_name].users.push(new_player);

        /***
         * Generate or re-generate `Top` attribute for each characters
         */
        for (let i=0; i<rooms[data.room_name].users.length; i++) {
            rooms[data.room_name].users[i].top = Math.floor(Math.random() * 120) + 100;
        }

        socket.to(data.room_name).emit('active_users_in_room_client', {data: rooms[data.room_name]});
        socket.emit('active_users_in_room_client', {data: rooms[data.room_name]});

        /***
         * Create a log on the specific room, under the message tab, saying a new player popped in.
         */
        let new_message = {};
        new_message['socket_id'] = 'Robot';
        new_message['message'] = 'New player <i>'+socket.id+'</i> joins this room.';
        rooms[data.room_name].message_logs.push(new_message);
        socket.to(data.room_name).emit('message_log_client', {data: new_message});
        socket.emit('message_log_client', {data: new_message});

    });

    /***
     * This is for the chat portal on a specific room
     */
    socket.on('create_message_log_server', function(data) {
        let new_message = {};
        new_message['socket_id'] = socket.id;
        new_message['message'] = data.data.message;
        rooms[data.data.room_name].message_logs.push(new_message);
        socket.to(data.data.room_name).emit('message_log_client', {data: new_message});
        socket.emit('message_log_client', {data: new_message});
    });

    /***
     * Gameplay Sockets Listener | What this does is it generates a random `top` coordinates on each characters that are in the room. This is being used on the following events:
     *   
     *   event 1: whenever the a new user hops on the room (first person in the room)
     *   event 2: whenever another person hops on the room (second person) tho this is also has the same function of event 1.
     *   event 3: whenever both of players are playing, but suddenly 1 disconnects/refresh.
     *
     */
    socket.on('update_my_character_on_room_server', function(data) {

        for(let i=0; i<rooms[data.data.room_name].block.length; i++) {
            if (rooms[data.data.room_name].block[i].left < -50) {
                rooms[data.data.room_name].block[i].left = 400;
            } else {
                rooms[data.data.room_name].block[i].left = rooms[data.data.room_name].block[i].left - 5;
            }
        }
    
        for(let i=0; i<rooms[data.data.room_name].users.length; i++) {
            rooms[data.data.room_name].users[i].top = rooms[data.data.room_name].users[i].top + 5;
        }   
        socket.to(data.data.room_name).emit('update_characters_dom_client', {data: rooms[data.data.room_name]});
        socket.emit('update_characters_dom_client', {data: rooms[data.data.room_name]});
    });


    /***
     * Gameplay Sockets Listener | What this does is it minuses the specific character's top (for it to go upwards) of whoever requested this listener.
     */
    socket.on('client_character_jump_update_server', function(data) {

        for(let i=0; i<rooms[data.data.room_name].users.length; i++) {
            if (rooms[data.data.room_name].users[i].name == data.data.socket_id) {
                rooms[data.data.room_name].users[i].top = rooms[data.data.room_name].users[i].top - 50;
                break;
            }
        }
    });

    /***
     * Gameplay Socket Listener | What this does is to fetch the character with the least amount of `Top` attribute. Declaring it as the winner.
     */
    socket.on('fetch_who_win_server', function(result) {

        let winner = rooms[result.data.room_name].users[0];
        
        for (let i=0; i<rooms[result.data.room_name].users.length; i++) {

            if (result.data.error_type === 'block_detection') {
                if (winner.top < rooms[result.data.room_name].users[i].top) {
                    winner = rooms[result.data.room_name].users[i];
                }
            } else if (result.data.error_type === 'reach_bottom') {
                if (winner.top > rooms[result.data.room_name].users[i].top) {
                    winner = rooms[result.data.room_name].users[i];
                }                
            }
        }

        socket.to(result.data.room_name).emit('display_who_win_room_client', {data: winner});
        socket.emit('display_who_win_room_client', {data: winner});

        /***
         * Just add a message on the room declaring the winner
         */
        if (rooms[room_name_dc] != null) {
            let new_message = {};
            new_message['socket_id'] = 'Robot';
            new_message['message'] = 'Player <i><b>'+winner.name+'</b></i> won the game coz the other player <b>'+result.data.error_type+'</b>';
            rooms[room_name_dc].message_logs.push(new_message);
            socket.to(room_name_dc).emit('message_log_client', {data: new_message});
            socket.emit('message_log_client', {data: new_message});
        }
    });

    /***
     * What this does is listening to the client if the restart button is clicked. Generate random character's `top` coordinates for each players
     */
    socket.on('restart_game_server', function(data) {

        for(let i=0; i<rooms[data.room_name].block.length; i++) {
            rooms[data.room_name].block[i].left = 400;
        }

        for (let i=0; i<rooms[data.room_name].users.length; i++) {
            rooms[data.room_name].users[i].top = Math.floor(Math.random() * 120) + 100;
        }
        /***
         * What this does on the client's end is just placing each characters to the gameboard, and logging who are online in the room
         */
        socket.to(data.room_name).emit('active_users_in_room_client', {data: rooms[data.room_name]});
        socket.emit('active_users_in_room_client', {data: rooms[data.room_name]});

        /***
         * Emitting this event specifically to the player who clicked the restart button
         */
        socket.emit('restart_game_client');

    });

    /***
     * Handles the `disconnect` function of a client socket
     */
    socket.on('disconnect', function() {

        /***
         * What this does is it removes the client's socket_id on the rooms object. This is the client who disconnected to that room.
         */
        let room_name = '';
        Object.keys(rooms).forEach((key) => {
            rooms[key].users = rooms[key].users.filter((user) => {
                room_name = key;
                return user.name !== socket.id;
            })
        });

        socket.to(room_name_dc).emit('active_users_in_room_client', {data: rooms[room_name]});
        socket.emit('active_users_in_room_client', {data: rooms[room_name]});

        /***
         * This is for the homepage to update the room list
         */
        socket.emit('update_room_list_client', {data: {rooms}});
        socket.broadcast.emit('update_room_list_client', {data: {rooms}});

        // When user disconnects, Send a robot message on the room message logs 
        // - Currently disabled or on comment because there is a bug where when someone disconnects on a specific room, It create logs to all room. Charot lang pala.
        if (rooms[room_name_dc] != null) {
            let new_message = {};
            new_message['socket_id'] = 'Robot';
            new_message['message'] = 'Player <i>'+socket.id+'</i> left the room.';
            rooms[room_name_dc].message_logs.push(new_message);
            socket.to(room_name_dc).emit('message_log_client', {data: new_message});
        }

    });

});

/***
 * A route to handle homepage or index
 */
app.get('/', function (request, response) {
    response.render('index', {data: rooms});
});

/***
 * A route to handle single player template
 */
app.get('/single-player', function (request, response) {
    response.render('singleplayer-playboard');
});

/***
 * This is a route to handle GET request by the client, in here we create andpush a `new room` on the `rooms` variable.
 */
app.get('/create-room', function(request, response) {
    room_count = room_count + 1;
    rooms['Room'+room_count] = { users: [], message_logs: [], block: [{'height': 150, 'left': 300}] };
    response.json(rooms);
});

/***
 * This route is used to handle dynamic room GET request by the client
 */
app.get('/(:room)', function(request, response) {

    if (rooms[request.params.room] == null) {
        /***
         * Check if the `Room` requested by the client is exisiting in rooms array. If NULL, simply redirect the client to the homepage.
         */
        return response.redirect('/');
    } else if (rooms[request.params.room].users.length == 2) {
        /***
         * Check if the `Room` requested by the client is full. If `Room` is full, simply redirect the client to the homepage.
         */
        return response.redirect('/');
    } else if (rooms[request.params.room].users.length < 2) {
        /***
         * If the `Room` only has 1 user, then accept the client as new scoket to the room.
         */
        return response.render('multiplayer-playboard', {room_name: request.params.room});
    }

});