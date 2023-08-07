let portNum                                  = 3000;
let fs                                       = require('fs');
let express                                  = require('express')
let socket                                   = require('socket.io');

let app                                      = express();
let io;
let server;

const axios = require('axios');

const encodedParams = new URLSearchParams();
encodedParams.set('url', 'https://google.com/');

const options = {
    method: 'POST',
    url: 'https://url-shortener-service.p.rapidapi.com/shorten',
    headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'X-RapidAPI-Key': 'f37b3d141dmsh8ae2520fc61fd92p1145d9jsn04393b211eec',
        'X-RapidAPI-Host': 'url-shortener-service.p.rapidapi.com'
    },
    data: encodedParams,
};


server = app.listen(portNum, function () {

    console.log(`Starting on port ${portNum}`)

    app.use(express.static('public'))

    io = socket(server);

    io.on('connection', (socket) => {

        socket.on('js', async function (data) {
            try {
                let msg = JSON.parse(data);

                switch (msg.type) {
                    case'recUrl':
                            encodedParams.set('url', msg.url)
                            const response = await axios.request(options);
                            io.emit('html', JSON.stringify({type:'recUrl', url:response.data.result_url}))
                        break;
                    default:
                        break;
                }

            } catch (e) {
                console.log(e.message);

            }
        })

    })
})




