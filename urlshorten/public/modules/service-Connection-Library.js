/*

Author: Lawrence F. Jasper III
Module_Version: v1.3
Date: 12/28/21


* UPDATES

* added version commenting to modules
* added version control var for modules
* by popular request, changed the "myData" event to "response"
* removed heart beat from the global scope
* fixed event bug
* Added mosquitto broker check and install...
* */
const module_version                          = '1.3'
let process                                   = require('process');
let {exec}                                    = require("child_process");
let mqtt                                      = require('mqtt')
let events                                    = require('events');
let moment                                    = require('moment')
let client                                    = mqtt.connect('mqtt://localhost')
/*dependencies*/
let servicePID
let serviceName
let capabilities                              = []
let directionType
let version
let srvcMngmntTopic
let myPublishArrayApps                        = []
let app                                       = []
let chk
const evnt                                    = new events.EventEmitter();
let heart_beat                                = 0
let beat
/*basic config vars*/

// let noConsole                                 = true
// let errorConsole                              = true
// let warnConsole                               = true
// let criticalConsole                           = true

let noConsole                                  = false
let errorConsole                               = false
let warnConsole                                = false
let criticalConsole                            = false
let hb                                         = false
/*Console Log Vars*/

exec('mosquitto', (error, stdout, stderr) => {
    if (error) {
        if(error.message.includes('Error: Address already in use') ){
            errors('none', `Mosquitto Broker is running...`)
        }else{
            errors('er', `Mosquitto Broker was down, booting now...`)
            exec('sudo apt install -y mosquitto mosquitto-clients', (error, stdout, stderr) => {
                if (error) {
                    console.log(error)
                }else{
                    console.log(stdout)
                    exec('sudo systemctl enable mosquitto.service', (error, stdout, stderr) => {
                        if (error) {
                            console.log(error)
                        }else{
                            console.log(stdout)
                            exec('sudo mosquitto -v', (error, stdout, stderr) => {
                                if (error) {
                                    console.log(error)
                                } else {
                                    console.log(stdout)
                                }

                            })
                        }
                    });
                }
            });


        }
        return;
    }
    if (stderr) {
        errors('none', `stderr: ${stderr}`)
    }
});


function configure(name_Of_Service, verz, service_Capabilities, direction_Type){
    servicePID = process.pid

    if(typeof name_Of_Service === "string" && typeof verz === "number" && typeof service_Capabilities === "string" || typeof service_Capabilities === "object"  && typeof direction_Type === "string"){
        //service capabilities
        if(typeof service_Capabilities === "object") {
            service_Capabilities.forEach(index => {capabilities.push(index)})
        }else if(service_Capabilities === "string"){
            capabilities = service_Capabilities
        }
        serviceName = name_Of_Service // this is the name to reference your service during emit
        version = verz
        directionType = direction_Type
        srvcMngmntTopic = `srvc/${serviceName}/v${version}/${servicePID}`
        errors('none', 'Configure Func Successful')
        start()
    }else{
        errors('crt',`One or more of your configure properties is incorrect, please check and try again.`)
    }
}

function start(){
    errors('none', 'Service-Connection-Library starting...')

//publishes
// first message sent if *service* launches after the *app*

    client.publish('service/mngmt', JSON.stringify({ type: 'serviceAvailable', serviceName: serviceName, directionType: directionType, version: version, pid:servicePID, from:serviceName, srvcMngmntTopic:srvcMngmntTopic, mv:module_version}))// first message sent if service launches after the app
    client.publish('system/manager', JSON.stringify({newTopic:srvcMngmntTopic}))// sends new dynamic channel to the system manager
    errors('none', 'Service publishes to "service/mngmt" and "system/manager"..')

    client.subscribe('app/mngmt')
    client.subscribe(srvcMngmntTopic)
    errors('none', `Service subscribes to "app/mngmt" and "${srvcMngmntTopic}"..`)

    client.on('connect', function(e) {
        evnt.emit('connect', serviceName, e)
    })

    client.on('message', function (topic, message) {// receives the topic and the message from any subscriptions on the service
        try{
            let msg = JSON.parse(message)// message parser
            switch (topic) {
                case'app/mngmt':// if the service is already running, this will be the first case to hit from an app, the service
                    // receives a copy of the app's dynamic channel for communication
                    try{
                        switch (msg.type) {// determines case based off the type in the message
                            case 'servicesReq':
                                errors('none','Service receives message from App @ "servicesReq"')

                                myPublishArrayApps.unshift({topic:msg.appMngmntTopic, name:msg.appName})// copy for the service
                                // will happen before filter, this why the else exists
                                errors('none','Service adds app to array of apps (may only be temporary...)')

                                setTimeout(() => {// a delay is used to allow the stuff above to take place before the final client.publish message is sent.
                                    client.publish(msg.appMngmntTopic, JSON.stringify({ type: 'serviceAvailable', serviceName: serviceName, directionType: directionType, version: version, pid:servicePID, from:serviceName, srvcMngmntTopic:srvcMngmntTopic, mv:module_version}))
                                    errors('none','Service sends "ServiceAvailable" message to App')
                                },700)
                                break;
                        }
                    }catch (e) {
                        errors('crt',`@ servicesReq case`)
                    }
                    break;
                case srvcMngmntTopic:
                    if(msg.type !== 'heart_beat'){
                        evnt.emit('response', message);
                    }
                    try{
                        switch (msg.type) {
                            case 'serviceCapabilityRequest'://used in both cases, that's why we have a check here, to avoid duplicates!
                                // evnt.emit('response', message);
                                errors('none',`Service receives message from App @ "serviceCapabilityRequest"`)

                                chk = myPublishArrayApps.findIndex((index) => index.topic === msg.appMngmntTopic)// check var will either find an index or it won't, if it doesn't, the response is -1
                                errors(`none`,`Service is checking to see if App already exists in Service's array of Apps...`)
                                if(chk === -1){ //if not found inside of the array
                                    myPublishArrayApps.unshift({topic:msg.appMngmntTopic, name:msg.from})// after check, if it's not already inside the array, it's pushed
                                    errors(`none`,`Service has determined the App is not already in the array, Service is adding App to its array of Apps.`)
                                }else{
                                    errors(`none`,`Service has determined the App is already in the array of Apps.`)
                                }
                                setTimeout(() => {// delay so that messages flow correctly
                                    client.publish(msg.appMngmntTopic, JSON.stringify({ type: 'serviceCapabilityResp', name:serviceName, capabilities:capabilities, from:serviceName, srvcMngmntTopic:srvcMngmntTopic}));
                                    errors('none',`Service sends "serviceCapabilityResp" message to App.`)
                                },700)
                                break;
                            case 'serviceConfig':
                                // evnt.emit('response', message);
                                app.unshift(msg.appMngmntTopic)
                                errors('none', 'Service adds App to the another array of App Names.')
                                errors('none', 'Service configured with app')

                                evnt.emit('complete', msg.appName);

                                beat = setInterval(heartBeat, 1000,msg) // starts the service heart beat after config
                                setInterval(paceMaker,1000,msg) // resets the app heart beat every second
                                break;
                            case 'removeAppFromPublishArray':
                                // evnt.emit('response', message);
                                let myIndex = myPublishArrayApps.findIndex((index) => index.topic === msg.appMngmntTopic)// process to remove any app that rejects the service
                                myPublishArrayApps.splice(myIndex,1)
                                break;
                            case 'heart_beat':
                                heart_beat = 0
                                break
                            default:
                                break;
                        }
                    }catch (e) {
                        errors('crt','@ serviceCapabilityRequest or serviceConfig or removeAppPublishArray')
                    }
                    break;
            }
        }catch (e) {
            errors('crt','@ app/mngmt or ${srvcMngmntTopic} case')
        }
    });
}

function send(app, obj){
    let cnt = 0
    myPublishArrayApps.forEach(index=>{
        if(index.name === app){
            client.publish(index.topic,obj)
            cnt++
        }else if(cnt === myPublishArrayApps.length){
            errors('warn', 'service does not exist')
        }
    })
}

function send_All(obj){
    myPublishArrayApps.forEach(index=>{
        client.publish(index.topic,obj)
    })
}

function errors(intensity, errorMessage){
    let timestamp = moment().format("MMM DD YYYY_~_hh:mm:ss:SSS");
    try{
        switch (intensity) {
            case 'none':
                if(noConsole === true){console.log(`FROM: ${serviceName}, Info: ${errorMessage} @ ${timestamp}`)}
                break
            case 'warn':
                if(warnConsole === true){console.warn(`FROM: ${serviceName}, WARN: ${errorMessage} @ ${timestamp}`)}
                break
            case 'er':
                if(errorConsole === true){console.error(`FROM: ${serviceName}, ERROR: ${errorMessage} @ ${timestamp}`)}
                break
            case 'crt':
                if(criticalConsole === true){console.error(`FROM: ${serviceName}, CRITICAL ERROR: ${errorMessage} @ ${timestamp}`)}
                break
            case 'hb':
                if(hb === true){console.error(`FROM: ${serviceName}, HB: ${errorMessage} @ ${timestamp}`)}
                break
            default:
                break;
        }
    }catch (e) {
        console.log(e)
    }
}

function heartBeat(msg){
    heart_beat++
    errors(`hb`,heart_beat)
    if(heart_beat <= 8){
        // do nothing
    }else if(heart_beat > 8){
        clearInterval(beat)
        heart_beat = 0
        evnt.emit('disconnect', msg.appName )
    }
}

function paceMaker(msg){
    client.publish(msg.appMngmntTopic, JSON.stringify({ type: 'heart_beat', name:serviceName, from:serviceName, srvcMngmntTopic:srvcMngmntTopic}));
}

module.exports = {app, serviceName, srvcMngmntTopic, send, send_All, evnt, configure, errors, module_version}
/*

    app                     - The array of app connections (Dynamic Topics) that the service can connect to
    serviceName             - The name of your configured service
    srvcMngmntTopic         - The topic of your configured service
    send()                  - This function emits messages between the service and the app
    send_All()              - This function emits messages to all apps configured with service
    evnt                    - This var allows the app/service to receive messages
    configure()             - This function allows for configuration of the app/service
    errors()                - This function allows for error logging

*/

