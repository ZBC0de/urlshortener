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
let appPID
let appName
let version
let appMngmntTopic
let myPublishArrayServices                     = []
let service                                    = []
let serviceCheck                               = [] // links with ServiceName var from service
let config                                     = []
const evnt                                     = new events.EventEmitter();
let heart_beat                                 = 0
let beat
/*basic config vars*/

// let noConsole                                  = true
// let errorConsole                               = true
// let warnConsole                                = true
// let criticalConsole                            = true

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





function configure(name_Of_App, verz, services_Needed){
    appPID = process.pid

    if(typeof name_Of_App === "string" && typeof verz === "number" && typeof services_Needed === 'object'){
        services_Needed.forEach(index=>{
            if(typeof index === 'string'){
                serviceCheck.push(index)
            }else if(typeof index === 'object'){
                serviceCheck.push(index.name)
                config.push({name:index.name, config:index.config})
            }
        })
        appName = name_Of_App // this is the name to reference your app during emit
        version = verz
        appMngmntTopic = `app/${appName}/v${version}/${appPID}`
        errors('none', 'Configure Func Successful')
        start()
    }else{
        errors('crt',`One or more of your configure properties is incorrect, please check and try again.`)
    }
}

function start(){
    errors('none', 'App-Connection-Library starting...')

// first message sent if *app* launches after the *service*
    client.publish('app/mngmt', JSON.stringify({ type: 'servicesReq', appName:appName, version:version, pid:appPID, from:appName, appMngmntTopic:appMngmntTopic}))// first message sent if app launches after the service
    client.publish('system/manager', JSON.stringify({newTopic:appMngmntTopic}))// sends new dynamic channel to the system manager
    errors('none', 'App publishes to "app/mngmt" and "system/manager"..')
//--Publishes--//

    client.subscribe('service/mngmt')
    client.subscribe(appMngmntTopic)
    errors('none', `App subscribes to "service/mngmt" and "${appMngmntTopic}"..`)
//--Subscribes--//

    /*channel configuration takes place here, this allows the app communication with the specified services it requires*/


    client.on('connect', function(e) {
        evnt.emit('connect', appName, e)
    })
    client.on('message', function (topic, message) {// receives the topic and the message from any subscriptions on the app
        try{
            let msg = JSON.parse(message)// message parser
            switch (topic) {
                case 'service/mngmt':// if the app is already running, this will be the first case to hit from a service, here, the app
                    // receives a copy of the service's dynamic channel for communication
                    try{
                        switch (msg.type) {
                            case'serviceAvailable':
                                errors('none', `App receives message from Service @ "serviceAvailable"`)
                                serviceCheck.forEach(function(index){// determines if the service is needed
                                    if(index === msg.serviceName){
                                        if(module_version === msg.mv){
                                            errors('none',`Service Required Found`)
                                            errors('warn',`App and Service versions are compatible!`)

                                            myPublishArrayServices.unshift({topic:msg.srvcMngmntTopic, name:msg.serviceName})// pushed into array
                                            errors('none',`App adds Service to array of services.`)

                                            // capability request is sent \/\/\/

                                            setTimeout(() => {
                                                client.publish(msg.srvcMngmntTopic, JSON.stringify({type:'serviceCapabilityRequest', from:appName, appMngmntTopic:appMngmntTopic}))
                                                errors('none',`App sends "serviceCapabilityRequest" message to Service.`)
                                            },700)

                                        }else{
                                            errors('warn',`App and Service versions do not match!`)
                                        }
                                    }
                                })
                                break;
                        }
                    }catch (e) {
                        errors('crt',`Module Error @ serviceAvailable case` )
                    }
                    break;
                case appMngmntTopic:// this case runs if a service starts before an app
                    try{
                        if(msg.type !== 'heart_beat'){
                            evnt.emit('response', message);
                        }
                        switch (msg.type) {
                            case'serviceAvailable':
                                // evnt.emit('response', message);
                                errors('none','App receives message from Service @ "serviceAvailable"')
                                serviceCheck.forEach(function(index){// determines if the service is needed
                                    if(index === msg.serviceName){
                                        if(module_version === msg.mv){
                                            errors('none',`Service Required Found`)
                                            errors('warn',`App and Service versions are compatible!`)

                                            myPublishArrayServices.unshift({topic:msg.srvcMngmntTopic, name:msg.serviceName})// pushed into array
                                            errors('none',`App adds Service to array of services.`)

                                            // capability request is sent \/\/\/

                                            setTimeout(() => {
                                                client.publish(msg.srvcMngmntTopic, JSON.stringify({type:'serviceCapabilityRequest', from:appName, appMngmntTopic:appMngmntTopic}))
                                                errors('none',`App sends "serviceCapabilityRequest" message to Service.`)
                                            },700)

                                        }else{
                                            errors('warn',`App and Service versions do not match!`)
                                        }
                                    }else{
                                        client.publish(msg.srvcMngmntTopic, JSON.stringify({type:'removeAppFromPublishArray', from:appName, appMngmntTopic:appMngmntTopic}))
                                        errors('none',`App has determined this Service is not required and will be removed from the array of Services.`)
                                    }
                                })
                                break;
                            case 'serviceCapabilityResp':// here, make sure to do the comparisons ------ SERVICE CAPABILITIES HERE
                                // evnt.emit('response', message);
                                errors(`none`,`App receives message from Service @ "serviceCapabilityResp"`)


                                client.publish(msg.srvcMngmntTopic, JSON.stringify({type:'serviceConfig', service:msg.name, appName:appName, capabilities:msg.capabilities, from:appName, appMngmntTopic:appMngmntTopic, config:config}))
                                errors(`none`,`App sends "serviceConfig" message to Service.`)
                                service.unshift(msg.srvcMngmntTopic)
                                errors(`none`,`App adds Service to the another array of Service Names.`)
                                errors('none', 'App configured with Service')
                                evnt.emit('complete', msg.name);

                                beat = setInterval(heartBeat, 1000, msg) // starts the app heart beat after config

                                setInterval(paceMaker,1000, msg) // resets the service heart beat every second

                                break;
                            case 'heart_beat':
                                heart_beat = 0
                                break
                            default:
                                break;
                        }
                    }catch (e) {
                        errors('crt',`Module error @ serviceAvailable or serviceCapabilityResp case`)
                    }
                    break;
            }
        }catch (e) {
            errors('crt',`Module error @ @ service/mngmt or ${appMngmntTopic} case`)
        }
    })
}

function send(service, obj){
    myPublishArrayServices.forEach(index=>{
        if(index.name === service){
            client.publish(index.topic,obj)
        }
    })
}

function errors(intensity, errorMessage){
    let timestamp = moment().format("MMM DD YYYY_~_hh:mm:ss:SSS");
    try{
        switch (intensity) {
            case 'none':
                if(noConsole === true){console.log(`FROM: ${appName}, Info: ${errorMessage} @ ${timestamp}`)}
                break
            case 'warn':
                if(warnConsole === true){console.warn(`FROM: ${appName}, WARN: ${errorMessage} @ ${timestamp}`)}
                break
            case 'er':
                if(errorConsole === true){console.error(`FROM: ${appName}, ERROR: ${errorMessage} @ ${timestamp}`)}
                break
            case 'crt':
                if(criticalConsole === true){console.error(`FROM: ${appName}, CRITICAL ERROR: ${errorMessage} @ ${timestamp}`)}
                break
            case 'hb':
                if(hb === true){console.error(`FROM: ${appName}, HB: ${errorMessage} @ ${timestamp}`)}
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
        evnt.emit('disconnect', msg.name )
    }
}

function paceMaker(msg){
    client.publish(msg.srvcMngmntTopic, JSON.stringify({type:'heart_beat', service:msg.name, appName:appName, from:appName, appMngmntTopic:appMngmntTopic}))
}


module.exports = {service, appName, appMngmntTopic, send, evnt, configure, errors, module_version, exec}

/*

    service                 - The array of service connections (Dynamic Topics) that the app can connect to
    appName                 - The name of your configured app
    appMngmntTopic          - The topic of your configured app
    send()                  - This function emits messages between the service and the app
    evnt                    - This var allows the app/service to receive messages
    configure()             - This function allows for configuration of the app/service
    errors()                - This function allows for error logging

*/
