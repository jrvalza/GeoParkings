

//------------------------------------------------------------------------------------------------------------
//----------------------------------------------Global variables----------------------------------------------
//------------------------------------------------------------------------------------------------------------





//--------------------------------Cordova Plugins--------------------------------

//cordova-plugin-device-orientation
var watchCompassID = null;
var compassOptions = { frequency: 100 };//0.1s


//----------------------------------Geolocation----------------------------------

//null=geolocation disable. not null=geolocation enable
var watchID = null;

//GeoJSON initial position
var initialPosition ={
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": []
    },
    "properties": {
        "name": "initial-position",
    }
};

//GeoJSON current position
var currentPosition ={
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": []
    },
    "properties": {
        "name": "current-position",
    }
};

//positioning options (1.GPS, 2. Wifi, 3.IP Adress)
var geolocationOptions = {
    enableHighAccuracy: true,//GPS
    timeout: 10000 //10seg of waiting for geolocation
};


//-----------------------------------Parkings------------------------------------

//GeoJSON parkings
var parking ={
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": []
    },
    "properties": {}
};

//Time control for periodic GET requests ->apiParkings()
var getParkingTimeout = null;
var getParkingInterval = null;
var showParkingInterval = null;

//save parkings GeoJSON grom GET request
var parkingArray = [];



//-----------------------------------Base Maps-----------------------------------

//Open Street Map - Tile Map Server (TMS)
var osm = L.tileLayer("https://{s}.tile.osm.org/{z}/{x}/{y}.png", {
    attribution: "&copy; <a href=\"https://openstreetmap.org/copyright\"> OpenStreetMap </a> contributors"
});

//WMS PNOA
var pnoa = L.tileLayer.wms(
    "http://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&",
    {layers: "OI.OrthoimageCoverage",
        tranparent: true,
        format: "image/jpeg",
        version: "1.3.0",
        attribution: "&copy; CNIG"
    }
);

//Map leaflet object
var map = L.map("map", {
    center: [40.0, -3.5],
    zoom: 5,
    minZoom: 5,
    zoomControl: true,
    layers: [osm]
});

//all base maps options
var baseMaps = {
    "OpenStreetMap": osm,
    "Ortofoto PNOA": pnoa
};

var layerControl = L.control.layers(baseMaps).addTo(map);

//save leaflet IDs of entities
var leafletCurrentPositionId = null;
var leafletParkingsIdArray = [];


//-----------------------------------Navigation----------------------------------
//coordinates of selected parking
var selectedParkingCoords = [];

//Instantiates a new router with the provided options
var router = L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1', // OSRM server
    timeout: 10000, //10seg
    profile: "driving",
});

//route found
var routeDictionary = {};


//-----------------------------default configuration-----------------------------

//format coordinates: geographic coordinates
var formatCoords = "geo";

//search distance squared
var refDistance = 1500;//1.5km
var squareDistanceRef = Math.pow(refDistance, 2);












//------------------------------------------------------------------------------------------------------------
//---------------------------------------Initial point for cordova apps---------------------------------------
//------------------------------------------------------------------------------------------------------------
//initial point for cordova apps
document.addEventListener('deviceready', onDeviceReady, false);
function onDeviceReady(){
    //Initial GUI
    initApp();
    showHiddendivHtmlCoordinates();

    //Click events
    document.getElementById("coordinates").addEventListener("click", currentFormatCoordinates);
    document.getElementsByClassName("fa-solid fa-location-dot")[0].addEventListener("click", toggleLocation);
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].addEventListener("click", findParkings);
    //document.getElementsByClassName("fa-solid fa-layer-group")[0].addEventListener("click", switchBaseMap);
}





//------------------------------------------------------------------------------------------------------------
//------------------------------------------------------Geolocation-------------------------------------------
//------------------------------------------------------------------------------------------------------------

//Geolocation: each x seconds get a new position.
function toggleLocation(){

    //Check status of geolocation (null=geolocation disable. not null=geolocation enable)
    if (watchID === null){

        //Start Geolocation
        showToast("Starting geolocation service.");
        watchID = navigator.geolocation.watchPosition(geolocationSucess, geolocationError, geolocationOptions);

        //Watch the compass sensor
        //startWatchCompass();

        //change color: geolocaton icon
        document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "orange";

        //
    }
    else{

        //Clear memory
        var response = clearMemory();
        if (!response){
            return;
        };

        //cordova
        /*var response = clearMemory();
        if (response === 2){//cancel
            return;
        };*/


        //Stop Geolocation
        showToast("Stopping geolocation service.");
        navigator.geolocation.clearWatch(watchID)// clean geolocation
        watchID=null;

        //Stop the compass sensor
        //stopWatchCompass();
    }
}


//Geolocation success
function geolocationSucess(position){

    //fill a global var currentPosition (geojson)
    currentPosition.geometry.coordinates = [position.coords.longitude, position.coords.latitude];
    currentPosition.properties.accuracy = position.coords.accuracy;
    currentPosition.properties.timestamp = position.timestamp;

    //fill a global var initialPosition (geojson)
    if (initialPosition.geometry.coordinates.length === 0){
        initialPosition.geometry.coordinates = [position.coords.longitude, position.coords.latitude];
    }

    //Borrar al pasar a cordova
    compassAngle = -45
    drawCurrentPosition(compassAngle);

    //show coordinates bar
    formatCoordinates();
    showHiddendivHtmlCoordinates();

    //zoom to existing map elements

    //change color: geolocaton icon
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "cyan";
}


//Geolocation error
function geolocationError(error){

    //reset default values
    watchID=null;
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "black";

    //error case evaluation
    switch(error.code){
        case error.PERMISSION_DENIED:
            showToast("Geolocation request denied.");
            break;
        case error.POSITION_UNAVAILABLE:
            showToast("Position unavailable.");
            break;
        case error.TIMEOUT:
            showToast("Geolocation request timed out.");
            break;
        case error.UNKNOWN_ERROR:
            showToast("Unknown geolocation error.");
            break;
    }
}



//distance calculation between our position at instant t and t+1
function distanceChangePosition(){

    //check there are coordinates
    if (initialPosition.geometry.coordinates.length === 0 & currentPosition.geometry.coordinates.length === 0){
        return;
    }

    //UTM coordinates initial position
    var utmInitialPosition = geoToUTM(initialPosition.geometry.coordinates)[0];//[x,y]
    var XutmInitialPosition = utmInitialPosition[0];
    var YutmInitialPosition = utmInitialPosition[1];

    //UTM coordinates current position
    var utmCurrentPosition = geoToUTM(currentPosition.geometry.coordinates)[0];//[x,y]
    var XutmCurrentPosition = utmCurrentPosition[0];
    var YutmCurrentPosition = utmCurrentPosition[1];

    //distance calculation
    var squareDistance = Math.pow(XutmInitialPosition - XutmCurrentPosition, 2) + Math.pow(YutmInitialPosition - YutmCurrentPosition, 2);

    return squareDistance;
}















//------------------------------------------------------------------------------------------------------------
//--------------------------------------------------Parkings--------------------------------------------------
//------------------------------------------------------------------------------------------------------------

function findParkings(){

    //Check status of geolocation
    if (watchID === null){
        alert("It is necessary to know your location before searching for parking spaces.");

        //cordova
        //showAlert("It is necessary to know your location before searching for parking spaces.");
        return;
    }

    //change search icon color
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "orange";

    //initial request GET --> apiParkings
    getParkings();

    //---------------following GET requests-->apiParkings---------------
    //geolocation start time
    const now = new Date();

    //time remaining to the nearest hour and minute in miliseconds
    const nextHour = new Date(now.getTime());
    nextHour.setUTCHours(now.getUTCHours() + 1, 1, 0, 0);
    const timeUntilNextRequest = nextHour - now;

    //GET requests every hour and one minute
    getParkingTimeout = setTimeout(() => {

        //request GET --> apiParkings
        getParkings();

        //GET request update interval
        getParkingInterval = setInterval(() => {

            //request GET --> apiParkings
            getParkings();
        }, 60*60*1000); // 60 minutes * 60 seconds * 1000 ms

    }, timeUntilNextRequest);
}


//GET request for parkings dataset
function getParkings() {
    showToast("Looking for parking spaces in your area.");

    //clear global variable
    parkingArray = [];

	//url of the API of public parking lots in the city of Valencia
	var url = "https://valencia.opendatasoft.com/api/explore/v2.1/catalog/datasets/parkings/records?limit=25";

	// Pattern to send GET requests
	//1.Create XHR instance
	var xhr = new XMLHttpRequest();

	//2.Open and send requests
    // Parameter 1: HTTP verb, Parameter 2: URL, Parameter 3: true=ansynchronous, false=synchronous
	xhr.open("GET", url, true);
	xhr.send();

	//3.Get the response
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4 && xhr.status == 200) {
            //JSON in text format
			var jsonText = xhr.responseText;

			//convert text to Object JSON
			jsonObjectParkings = JSON.parse(jsonText);

            //extracting parking information
            for (var count=0; count < jsonObjectParkings.results.length; count++){
                //info
                object = jsonObjectParkings.results[count];
                parking.geometry.coordinates = object.geo_shape.geometry.coordinates;
                parking.properties.name = object.nombre;
                parking.properties.total_parking = object.plazastota;
                parking.properties.free_parking = object.plazaslibr;
                parking.properties.last_update = object.ultima_mod;

                //save parking
                parkingArray.push(JSON.parse(JSON.stringify(parking)));
            }
        }
    }
    //show nearby parking lots
    showParkingInterval = setInterval(drawParking, 2000);//2seg

}




//obtaining the nearest parking spaces at each new position our
function nearParking(){
    //init
    var  nearParkingArray = [];

    //Check  there are coordinates
    if (currentPosition.geometry.coordinates.length === 0 || parkingArray.length === 0){
        return nearParkingArray;
    }

    //UTM coordinates
    var utmCurrentPosition = geoToUTM(currentPosition.geometry.coordinates)[0];//[x,y]
    var XutmCurrentPosition = utmCurrentPosition[0];
    var YutmCurrentPosition = utmCurrentPosition[1];

    //distance calculation
    parkingArray.forEach((parkingJSON) => {
        var utmParking = geoToUTM(parkingJSON.geometry.coordinates)[0];//[x,y]
        var XutmParking = utmParking[0];
        var YutmParking = utmParking[1];
        var squareDistance = Math.pow(XutmCurrentPosition - XutmParking, 2) + Math.pow(YutmCurrentPosition - YutmParking, 2);

        //nearby?
        if (squareDistance < squareDistanceRef) {
            nearParkingArray.push(parkingJSON);
        }
    })
    return nearParkingArray;
}










//------------------------------------------------------------------------------------------------------------
//---------------------------------------------Data visualization---------------------------------------------
//------------------------------------------------------------------------------------------------------------

//------Icons------
function getCustomCurrentPositionIcon(angle) {
    //Icon
    var currentPositionIcon = L.divIcon({
        html: `<i class="fa-solid fa-location-arrow" style="transform: rotate(${angle}deg); -ms-transform: rotate(${angle}deg); -webkit-transform: rotate(${angle}deg)"></i>`,
        className: 'currentPosition-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15], // central point
    });

    //Popup
    var popup = "";
    popup += "<div class='popupcustom'>";
    popup += "<div class='tab'>" + currentPosition.properties.name + "</div><br>";
    popup += "<table>";
    popup += "<tr><th>Latitud</th><td>" + currentPosition.geometry.coordinates[1].toFixed(8) + "</td></tr>";
    popup += "<tr><th>Longitud</th><td>" + currentPosition.geometry.coordinates[0].toFixed(8) + "</td></tr>";
    popup += "</table>";
    popup += "</div>";

    return [popup, currentPositionIcon];
}



function getCustomParkingIcon(point) {
    //Icon
    var color;
    if (point.properties.free_parking == 0) {//busy
        color = "black";
    }
    else if (point.properties.free_parking < 0) {//without information
        color = "gray";
    }
    else {//with free places
        color = "blue";
    }
    var parkingIcon = L.divIcon({
        html: `<i class="fa-solid fa-square-parking" style="color: ${color};"></i>`,
        className: 'parking-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    //Popup
    var popup = "";
    popup += "<div class='popupcustom'>";
    popup += "<div class='tab'>" + "Parking:<br>" + point.properties.name + "</div><br>";
    popup += "<table>";
    popup += "<tr><th>Latitud</th><td>" + point.geometry.coordinates[1].toFixed(8) +"</td></tr>";
    popup += "<tr><th>Longitud</th><td>" + point.geometry.coordinates[0].toFixed(8)+ "</td></tr>";
    popup += "<tr><th>Plazas totales</th><td>" +  point.properties.total_parking +"</td></tr>";
    popup += "<tr><th>Plazas libres</th><td>" + point.properties.free_parking + "</td></tr>";
    popup += "<tr><th>Fecha</th><td>" + point.properties.last_update + "</td></tr>";
    popup += "</table><br/>";
    popup +="<div class='btn'><button type='button' class='btn_navigation' onclick='findRoute()'>go to the parking?</button></div>";
    popup += "</div>";

    return [popup, parkingIcon];
}



//------show nerby parkings------
function drawParking(){

    //show nearby parking lots on the map only when our position changes by 50 m from the previous one
    var distance = distanceChangePosition();

    /*if (distance === 1){//cambiar la condicion a (distance <= 2500) cuando estemos en cordova
        return;
    }

    //update initial position coordinates
    initialPosition.geometry.coordinates = currentPosition.geometry.coordinates;
    */
    //Clear map leaflet each new user position
    if (leafletParkingsIdArray.length !== 0){
        for (var count = 0; count < leafletParkingsIdArray.length; count++){
            map.removeLayer(leafletParkingsIdArray[count]);
        };
    }
    //reset global variable value
    leafletParkingsIdArray = [];

    //------get nearby parkings------
    var nearParkingArray = nearParking();

    //check there are points
    if (nearParkingArray.length === 0){
        //showToast("There are no nearby parking facilities.");
        document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "black";
        return;
    }
    //draw points
    nearParkingArray.forEach((parking) => {
        //popup and style icon
        var customIcon = getCustomParkingIcon(parking);
        var popup =customIcon[0];
        var icon = customIcon[1];
        var leafletPointOptions = {icon: icon};

        //Leaflet marker
        var leafletPointID = L.marker(
            parking.geometry.coordinates.toReversed(),
            leafletPointOptions);

        //Link popup
        leafletPointID.bindPopup(popup);

        //Click event
        leafletPointID.on('click', onClick);

        //Add point to map
        leafletPointID.addTo(map);

        //add pointID to leafletParkingsIdArray
        leafletParkingsIdArray.push(leafletPointID);
    })

    //change search icon color
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "cyan";
}



//------show current position------
function drawCurrentPosition(compassAngle){

    //popup and style icon
    var customIcon = getCustomCurrentPositionIcon(compassAngle);
    var popup = customIcon[0];
    var icon = customIcon[1];
    var leafletPointOptions = {icon: icon};

    //Leaflet marker
    leafletCurrentPositionId = L.marker(
        currentPosition.geometry.coordinates.toReversed(),
        leafletPointOptions);

    //Link popup
    leafletCurrentPositionId.bindPopup(popup);

    //Click event
    leafletCurrentPositionId.on('click', onClick);

    //Add point to map
    leafletCurrentPositionId.addTo(map);

    //zoom to current position
    map.setView(currentPosition.geometry.coordinates.toReversed(), 14);
}







//------------------------------------------------------------------------------------------------------------
//-------------------------------------------Clear memory and map---------------------------------------------
//------------------------------------------------------------------------------------------------------------
function clearMemory(){

    //Ask to clear memory
    var clearMemory = confirm("Stop geolocation?");
    if (!clearMemory){
        return clearMemory;
    }

    //Cordova
    //Ask to clear memory
    /*var buttonIndex = onConfirm("Stop geolocation?");

    if (buttonIndex === 2){//cancel clear memory
        return buttonIndex;
    }*/

    //Clear memory
    parkingArray = [];

    initialPosition ={
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": []
        },
        "properties": {
            "name": "initial-position",
        }
    };

    currentPosition ={
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": []
        },
        "properties": {
            "name": "current-position",
        }
    };

    parking ={
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": []
        },
        "properties": {}
    };

    //Clear map leaflet
    //remove parkings
    for (var count = 0; count < leafletParkingsIdArray.length; count++){
        map.removeLayer(leafletParkingsIdArray[count]);
    }
    leafletParkingsIdArray = [];

    //remove current position
    map.removeLayer(leafletCurrentPositionId);
    leafletCurrentPositionId = null;

    //hide coordinates
    showHiddendivHtmlCoordinates()

    //change icon color
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "black";
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "black";

    // Clear timeout and interval
    if (getParkingTimeout !== null) {
        clearTimeout(getParkingTimeout);
        getParkingTimeout = null;
    }
    if (getParkingInterval !== null) {
        clearInterval(getParkingInterval);
        getParkingInterval = null;
    }
    if (showParkingInterval !== null) {
        clearInterval(showParkingInterval);
        showParkingInterval = null;
    }

    //Routing
    routeDictionary = {};

    return clearMemory;
    //return buttonIndex;
}






















//------------------------------------------------------------------------------------------------------------
//-----------------------------------------------Cordova Plugins----------------------------------------------
//------------------------------------------------------------------------------------------------------------

//------------------------------------Compass cordova------------------------------------
// Start watching the compass
function startWatchCompass() {
    if (watchCompassID === null){
        watchCompassID = navigator.compass.watchHeading(onSuccessCompass, onErrorCompass, compassOptions);
    }
}


//Get the current heading
function onSuccessCompass(heading) {
    //compass value
    var compassAngle = -45 + heading.magneticHeading;

    //drawing for the first time our position
    if (leafletCurrentPositionId === null & currentPosition.geometry.coordinates.length !==0){
        drawCurrentPosition(compassAngle);
    }
    else if (leafletCurrentPositionId){
        //update the icon orientation
        var customIcon = getCustomCurrentPositionIcon(compassAngle);
        icon = customIcon[1];
        leafletCurrentPositionId.setIcon(icon);
    }
}


//Stop watching the compass
function stopWatchCompass() {
    if (watchCompassID) {
        // clean compass
        navigator.compass.clearWatch(watchCompassID);

        //reset global variables
        watchCompassID = null;
    }
}



//Failed to get the heading
function onErrorCompass(error) {
    //reset default value
    watchCompassID=null;

    //error case evaluation
    switch(error.code){
        case error.COMPASS_INTERNAL_ERR:
            showToast("Compass request denied.");
            break;
        case error.COMPASS_NOT_SUPPORTED:
            showToast("Compass not supported.");
            break;
    }
}






//-----------------------------------Dialogues cordova-----------------------------------
function showAlert(message){
    //cordova-plugin-notification
    navigator.notification.alert(message,
                                function (){},//callback anonymous function
                                "GeoParkings", //title
                                "Ok"//name of option
                            );
}
function showConfirm(message){
    //cordova-plugin-notification
    navigator.notification.confirm(message,
                                onConfirm,//callback function
                                "GeoParkings", //title
                                ["OK","Cancel"]//name of options -> user bottoms. Ok=1, Cancel=2
                            );
}

//callback function
function onConfirm(buttonIndex){
    return buttonIndex;
    //if (buttonIndex == 1){
    //    console.log("Confirm");
    //}
}

/**/







//------------------------------------------------------------------------------------------------------------
//-------------------------------------------------Navigation-------------------------------------------------
//------------------------------------------------------------------------------------------------------------

function onClick(marker) {
    // get coordinate of selected parking
    var latlon = marker.latlng;
    //update global variables
    selectedParkingCoords = [latlon.lat, latlon.lng];
}







function findRoute() {
    //Ask if you want to start searching for a route
    var startNavigation = confirm("Do you want to find a route to the selected parking lot?");
    if (!startNavigation) {
        return;
    }

    //Check there are coordinates
    if (currentPosition.geometry.coordinates.length === 0 || selectedParkingCoords.length === 0) {
        showToast("It was not possible to obtain a route.");
        return;
    }

    showToast("Looking for an optimal route.");

    //Waypoints
    var startCoords = currentPosition.geometry.coordinates.toReversed(); // [lat, lng]
    var endCoords = selectedParkingCoords; // [lat, lng]

    //GET request for a route with the OSRM router
    router.route(
        waypoints = [
            L.Routing.waypoint(L.latLng(startCoords[0], startCoords[1])),
            L.Routing.waypoint(L.latLng(endCoords[0], endCoords[1]))
        ],
        callback = function (err, routes) {
            if (err) {
                console.error("Error when searching for the route:", err);
                return;
            }
            //Route found
            var routeObject = routes[0];

            //Process the route after obtaining it
            processRoute(routeObject);
        }
    );
}


function processRoute(routeObject){

    //Check that a route exists
    if (routeObject === null){
        showToast("It was not possible to obtain a route.");
        return;
    }

    //Get data
    var routeCoordinates = routeObject.coordinates;
    var routeInstructions = routeObject.instructions;
    var routeSummary = routeObject.summary;

    //Get route vertices with instructions.
    for (var count = 1; count < routeInstructions.length; count++){

        //start and end indexes
        var start = routeInstructions[count-1].index;
        var end = routeInstructions[count].index;

        //get segment coordinates [[lat, lng]]
        var segmentCoordsArray = routeCoordinates.slice(start, end).map(coord => [coord.lat, coord.lng]);

        //get instruction and add the corresponding coordinates
        var instruction = routeInstructions[count-1];
        instruction.coords = segmentCoordsArray;

        //update global varieble
        routeDictionary[count-1] = instruction;
    }

    //end instruction
    var start = routeInstructions[routeInstructions.length-2].index;
    var end = routeInstructions[routeInstructions.length-1].index;
    var segmentCoordsArray = routeCoordinates.slice(start, end).map(coord => [coord.lat, coord.lng]);
    var instruction = routeInstructions[routeInstructions.length-1];
    instruction.coords = segmentCoordsArray;

    //update global varieble
    routeDictionary[routeInstructions.length-1] = instruction;
    //console.log(JSON.stringify(routeDictionary, undefined, 4));
}










//------------------------------------------------------------------------------------------------------------
//------------------------------------------Miscellaneous functions-------------------------------------------
//------------------------------------------------------------------------------------------------------------

function initApp(){

    //Init-Get HTML elements
    var divMap = document.getElementById("map");
    var divMenu = document.getElementById("menu");
    var divCoordinates = document.getElementById("coordinates");
    var divInitialScreen = document.getElementById("initial-screen-container");

    //hide HTML elements
    divMap.style.display = "None";
    divMenu.style.display = "None";
    divCoordinates.style.display ="None";

    //after 4 seconds the second screen is displayed (map and menu)
    setTimeout(() => {
        //hide initial screen
        divInitialScreen.style.opacity = "0";
        setTimeout(() =>{
            //show second screen
            divMap.style.display = "block";
            divMenu.style.display = "block";
            setTimeout(() =>{
                divMap.style.opacity = "1";
                divMenu.style.opacity = "1";
            }, 0);//1000);
        }, 0);//1000);
    }, 0);//4000);
}





function showHiddendivHtmlCoordinates(){
    //Init-Get HTML elements
    var divMenu = document.getElementById("menu");
    var divCoordinates = document.getElementById("coordinates");
    var textCoordinates = document.getElementById("coordinates-text");

    //Chek there are coordinates
    if(currentPosition.geometry.coordinates.length === 0){
        //hide coordinates
        divCoordinates.style.opacity = "0";
        textCoordinates.style.opacity = "0";

        //set transform
        divMenu.style.transform = "translateY(-18%)";

        setTimeout(() =>{
            document.getElementById("coordinates-text").innerHTML = "";
        }, 3000);
    }
    else{
        //show coordinates
        divCoordinates.style.display = "block";
        divCoordinates.style.opacity = "1";
        textCoordinates.style.opacity = "1";

        //set transform
        divMenu.style.transform = "translateY(-50%)";
    }
}




//Toast
function showToast(message){
    var toast = document.getElementById("toast");

    //show toast
    toast.innerHTML = message;
    toast.style.opacity= "1";

    //hide toast
    setTimeout(() =>{
        toast.style.opacity= "0";
    }, 3000); //3seg
}




//Change the display format of coordinates
function currentFormatCoordinates () {
    //Check format coordinates
    if (formatCoords == "geo") {
        formatCoords = "dms";
    }
    else if (formatCoords == "dms") {
        formatCoords = "utm";
    }
    else if (formatCoords=="utm"){
        formatCoords = "geo";
    }
    //update coordinates format
    formatCoordinates();
}



//conversion between coordinate systems
function geoToUTM(geoPoint){
    //get UTM zone
    longitude = geoPoint[0];
    var zone = 1 + Math.floor((longitude+180)/6);//source: https://stackoverflow.com/questions/29655256/proj4js-can-you-convert-a-lat-long-to-utm-without-a-zone

    //From geo to utm
    //origin and target CRSs
    proj4.defs("UTM", "+proj=utm +zone=" + zone.toString() + "+ellps=GRS80 +units=m +no_defs"); //+no_defs: no default value
    proj4.defs("EPSG:4326", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");

    //convert to utm coordinates
    var utmPoint = proj4(proj4("EPSG:4326"), proj4("UTM"), geoPoint);

    return [utmPoint, zone];
}



//change the current format coordinates
function formatCoordinates(){
    //Check there are coordinates
    if (currentPosition.geometry.coordinates[0] == undefined){
        //alert("It is necessary to know your position before changing the coordinate format.");
        showAlert("It is necessary to know your position before changing the coordinate format.");
        return;
    }

    //Init
    var separator ="&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"; //&nbsp; = blank space in html
    var coordinatesString = "";
    var latitude = currentPosition.geometry.coordinates[1];
    var longitude = currentPosition.geometry.coordinates[0];
    var accuracy = currentPosition.properties.accuracy;

    //--------------------------format geo--------------------------
    if (formatCoords == "geo"){
        //coordinates with 8 decimals
        //output
        coordinatesString += latitude.toFixed(8);
        coordinatesString += separator;
        coordinatesString += longitude.toFixed(8);
        coordinatesString += separator;
        coordinatesString += "[" + accuracy.toFixed(2) + "]";
    }
    //--------------------------format dms--------------------------
    else if (formatCoords == "dms"){
        //------------ Longitude------------
        //Init
        var hemisphere = "E";
        if (longitude < 0){
            hemisphere ="W";
            longitude *= -1;
        }
        //conversion
        var degrees = Math.floor(longitude);
        var minutes = Math.floor((longitude - degrees) * 60);
        var seconds = ((longitude - degrees) * 60 - minutes) * 60;

        //number to string
        degrees = degrees.toString();
        minutes = minutes.toString();
        seconds = seconds.toFixed(3).toString(); // 3 decimals

        //format DDº MM' SS.SSS"
        if (degrees.length < 2){ degrees = degrees.padStart(2,0); }
        if (minutes.length < 2){ minutes = minutes.padStart(2,0); }
        if (seconds.split(".")[0].length < 2){ seconds = seconds.padStart(6,0); }

        longitude = degrees + "\u{00B0}" + minutes + "\u{0027}" + seconds + "\u{0022}" + hemisphere;

        //------------ Latitude------------
        //Init
        var hemisphere = "N";

        if (latitude < 0){
            hemisphere ="S";
            latitude *= -1;
        }
        //conversion
        degrees = Math.floor(latitude);
        minutes = Math.floor((latitude - degrees) * 60);
        seconds = ((latitude - degrees) * 60 - minutes) * 60;

        //to string
        degrees = degrees.toString();
        minutes = minutes.toString();
        seconds = seconds.toFixed(3).toString(); //3 decimals

        //format DDº MM' SS.SSS"
        if (degrees.length < 2){ degrees = degrees.padStart(2,0); }
        if (minutes.length < 2){ minutes = minutes.padStart(2,0); }
        if (seconds.split(".")[0].length < 2){ seconds = seconds.padStart(6,0); }

        latitude = degrees + "\u{00B0}" + minutes + "\u{0027}" + seconds + "\u{0022}" + hemisphere;

        //output
        coordinatesString += latitude;
        coordinatesString += separator;
        coordinatesString += longitude;
        coordinatesString += separator;
        coordinatesString += "[" + accuracy.toFixed(2) + "]";
    }
    //--------------------------format utm--------------------------
    else if (formatCoords == "utm"){
        // Init
        var geoPoint=[longitude, latitude];

        //coordinate conversion
        var utmPoint_zone = geoToUTM(geoPoint);
        var utmPoint = utmPoint_zone[0];
        var zone = utmPoint_zone[1];

        var xUTM = utmPoint[0].toFixed(3).toString();
        var yUTM = utmPoint[1].toFixed(3).toString();

        //output
        coordinatesString += zone;
        coordinatesString += separator;
        coordinatesString += xUTM;
        coordinatesString += separator;
        coordinatesString += yUTM;
        coordinatesString += separator;
        coordinatesString += "[" + accuracy.toFixed(2) + "]";
    }
    //output
    document.getElementById("coordinates-text").innerHTML = coordinatesString;
}

