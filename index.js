
require('newrelic');

var util = require('util'),
    pg = require('pg'),
    nforce = require('nforce'),
    express = require('express'),
    nest = require('unofficial-nest-api'); 

    var app = express();
//var pgConString = "postgres://localhost/bcline";

app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
  response.send('Hello World!')
})

// update interval in ms
var updateInterval = 1000*60*15;

//Salesforce User Id
var sfuser = '**Salesforce Username***';
var sfpass = '**Salesforce Password***';

//Nest User Id
var username = '***Nest UserName****';
var password = '***Nest Password***';

nest.login(username, password, function (err, data) {
    if (err) {
        console.log(err.message);
        process.exit(1);
        return;
    }
});

var org = nforce.createConnection({
  clientId: '3MVG9xOCXq4ID1uFile8ZrQWJZOPCGeW1QAS7Rix.ui4NsTWnG6QtQQKOucV8GE_Gg9wYMV6bJWEG3MTD4Xm3',
  clientSecret: '1189573986910105241',
  redirectUri: 'http://localhost:3000/oauth/_callback',
  environment: 'production',
  apiVersion: 'v25.0'
});

/*
pg.connect(process.env.DATABASE_URL, function(err, client) {
  if(err) {
    console.log(err);
  }
  client.on('notification', function(msg) {
    console.log('sending to I');
    SFDCClientInterpreter.execute(msg); 
  });
  var query = client.query("LISTEN requestedtemp");
});

*/

org.authenticate({ username: sfuser, password: sfpass}, function(err, oauth){
  
  if(err) return console.log(err);

  var str = org.stream({ topic: 'NestMonitor', oauth: oauth });

  str.on('connect', function(){
    console.log('connected to pushtopic');
  });

  str.on('error', function(error) {
    console.log('error: ' + error);
  });

  str.on('data', function(data) {
    console.log(data);
     SFDCClientInterpreter.execute(data); 
  });

});



var SFDCClientInterpreter = {
      execute: function (data) {
          processTempRequest (data.sobject.device_id__c, data.sobject.target_temperature__c);
      }

};

 
function trimQuotes(s) {
    if (!s || s.length === 0) {
        return '';
    }
    var c = s.charAt(0);
    var start = (c === '\'' || c === '"') ? 1 : 0;
    var end = s.length;
    c = s.charAt(end - 1);
    end -= (c === '\'' || c === '"') ? 1 : 0;
    return s.substring(start, end);
}
 
function merge(o1, o2) {
    o1 = o1 || {};
    if (!o2) {
        return o1;
    }
    for (var p in o2) {
        o1[p] = o2[p];
    }
    return o1;
}

function processTempRequest (device, temp) {
  console.log('process temp');
  nest.setTemperature(device, temp);
}



function updateTemp (temp, device) {
  console.log ('update temp' + temp);

  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    //var updateQuery = "UPDATE nest(current_temperature__c) VALUES($1) WHERE id = $2";
    var updateQuery = "UPDATE salesforce.nest__c SET current_temperature__c = $1 where device_id__c = $2;"
    //ar updateQuery = "UPDATE nest SET current_temperature__c = 74 where id=1"
      client.query(updateQuery, [temp, device], function(err, result) {
        done();
        if (err)
         { console.log(err); }
        else
         { console.log(result.rows); }
      });
    });



  
}
 
function fetchData(data) {
    nest.login(username, password, function (err, data) {
        if (err) {
            console.log(err.message);
            process.exit(1);
            return;
        }
 
      nest.fetchStatus(function (data) {
              for (var deviceId in data.device) {
              if (data.device.hasOwnProperty(deviceId)) {
                  var shared = data.shared[deviceId];
                  var date = new Date();
                  var currentTemp = nest.ctof(shared.current_temperature);

                  updateTemp(currentTemp, deviceId);

                  var time = date.getFullYear()+'/'+date.getMonth()+'/'+date.getDate()+'-'+date.getHours()+':'+date.getMinutes();
       
                          console.log(util.format("%s %s [%s], Current temp: %d F Current Humidity: %d %% Target temp: %d",
                              time,
                              shared.name, deviceId,
       
                              nest.ctof(shared.current_temperature),
                              data.device[deviceId].current_humidity,
       
                              nest.ctof(shared.target_temperature)));

                  

              }
          }
      });
    });
}
 
fetchData();
setInterval(fetchData,updateInterval);

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})