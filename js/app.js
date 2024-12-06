

//------------------------------------------------------------------------------------------------------------
//----------------------------------------------Global variables----------------------------------------------
//------------------------------------------------------------------------------------------------------------





//--------------------------------Cordova Plugins--------------------------------

//Cordova-plugin-device-orientation
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

//Positioning options (1.GPS, 2. Wifi, 3.IP Adress)
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

//Save parkings GeoJSON grom GET request
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

//All base maps options
var baseMaps = {
    "OpenStreetMap": osm,
    "Ortofoto PNOA": pnoa
};

var layerControl = L.control.layers(baseMaps).addTo(map);

//Save leaflet IDs of entities
var leafletCurrentPositionId = null;
var leafletParkingsIdArray = [];
var leafletRouteId = null;


//-----------------------------------Navigation----------------------------------

//Selected parking leaflet object
var selectedParkingObject = null;

//Instantiates a new router with the provided options
var router = L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1', // OSRM server
    timeout: 10000, //10seg
    profile: "driving",
});

//Route found
var routeDictionary = {};

//DrawRoute options
var drawRouteOptions = {
    color: 'blue',
    weight: 8,
    opacity: 0.3,
    lineCap: 'round',
    lineJoin: 'round',
};




//-----------------------------Default configuration-----------------------------

//Format coordinates: geographic coordinates
var formatCoords = "geo";

//Search distance squared
var refDistance = 1500;//1.5km
var squareDistanceRef = Math.pow(refDistance, 2);












//------------------------------------------------------------------------------------------------------------
//---------------------------------------Initial point for cordova apps---------------------------------------
//------------------------------------------------------------------------------------------------------------

//Initial point for cordova apps
document.addEventListener('deviceready', onDeviceReady, false);
function onDeviceReady(){

    //Initial GUI
    initApp();

    //Click events
    document.getElementById("coordinates").addEventListener("click", currentFormatCoordinates);
    document.getElementsByClassName("fa-solid fa-location-dot")[0].addEventListener("click", toggleLocation);
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].addEventListener("click", findParkings);
    document.getElementsByClassName("fa-solid fa-route")[0].addEventListener("click", startNavigation);
    //document.getElementsByClassName("fa-solid fa-layer-group")[0].addEventListener("click", drawRoute);
}





//------------------------------------------------------------------------------------------------------------
//------------------------------------------------------Geolocation-------------------------------------------
//------------------------------------------------------------------------------------------------------------

//Geolocation: each x seconds get a new position.
function toggleLocation(){

    //Check status of geolocation (null=geolocation disable. not null=geolocation enable)
    if (watchID === null){

        //Change color: geolocaton icon
        document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "orange";

        //Start Geolocation
        showToast("Starting geolocation service.");
        watchID = navigator.geolocation.watchPosition(geolocationSucess, geolocationError, geolocationOptions);

        //Watch the compass sensor
        //watchCompassID = navigator.compass.watchHeading(onSuccessCompass, onErrorCompass, compassOptions);
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
        //navigator.compass.clearWatch(watchCompassID);
        //watchCompassID = null;
    }
}


var a = 0;//BORRAR AL PASAR A CORDOVA
//Geolocation success
function geolocationSucess(position){

    //PRUEBA---------BORRAR AL PASAR A CORDOVA
    a +=0.001;
    var dlat = -2*a;
    var dlon = -a

    //Change color: geolocaton icon
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "cyan";

    //Fill a global var currentPosition (geojson)
    currentPosition.geometry.coordinates = [position.coords.longitude + dlon, position.coords.latitude + dlat];
    currentPosition.properties.accuracy = position.coords.accuracy;
    currentPosition.properties.timestamp = position.timestamp;

    //Fill a global var initialPosition (geojson)
    if (initialPosition.geometry.coordinates.length === 0){
        initialPosition.geometry.coordinates = [currentPosition.geometry.coordinates[0], currentPosition.geometry.coordinates[1]];//[lng, lat]
    }

    //PRUEBA-------------BORRAR AL PASAR A CORDOVA
    if (leafletCurrentPositionId === null && currentPosition.geometry.coordinates.length !==0){
        compassAngle = -45
        drawCurrentPosition(compassAngle);
    }

    //Update the coordinates of our position marker
    if (leafletCurrentPositionId !== null){
        var newLatLng = L.latLng(currentPosition.geometry.coordinates[1], currentPosition.geometry.coordinates[0]);//[lat,lng]
        leafletCurrentPositionId.setLatLng(newLatLng);

        //Show/Hide HTML elements
        formatCoordinates();
        showHideElements();
    }

    //Zoom to existing map elements
}


//Geolocation error
function geolocationError(error){

    //Reset default values
    watchID=null;
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "black";

    //Error case evaluation
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



















//------------------------------------------------------------------------------------------------------------
//--------------------------------------------------Parkings--------------------------------------------------
//------------------------------------------------------------------------------------------------------------

//Initial request for parking spaces to the API of the city of Valencia
function findParkings(){

    //Check status of geolocation
    if (watchID === null){
        alert("It is necessary to know your location before searching for parking spaces.");

        //cordova
        //showAlert("It is necessary to know your location before searching for parking spaces.");
        return;
    }

    //Change search icon color
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "orange";

    //Initial request GET --> apiParkings
    getParkings();

    //---------------Following GET requests-->apiParkings---------------
    //Geolocation start time
    const now = new Date();

    //Time remaining to the nearest hour and minute in miliseconds
    const nextHour = new Date(now.getTime());
    nextHour.setUTCHours(now.getUTCHours() + 1, 1, 0, 0);
    const timeUntilNextRequest = nextHour - now;

    //GET requests every hour and one minute
    getParkingTimeout = setTimeout(() => {

        //Request GET --> apiParkings
        getParkings();

        //GET request update interval
        getParkingInterval = setInterval(() => {

            //Request GET --> apiParkings
            getParkings();
        }, 60*60*1000); // 60 minutes * 60 seconds * 1000 ms

    }, timeUntilNextRequest);
}


//GET request for parkings dataset
function getParkings() {

    showToast("Looking for parking spaces in your area.");

    //Clear global variable
    parkingArray = [];

	//Url of the API of public parking lots in the city of Valencia
	var url = "https://valencia.opendatasoft.com/api/explore/v2.1/catalog/datasets/parkings/records?limit=25";

	// Pattern to send GET requests
	//1.Create XHR instance
	var xhr = new XMLHttpRequest();

	//2.Open and send requests
    //Parameter 1: HTTP verb, Parameter 2: URL, Parameter 3: true=ansynchronous, false=synchronous
	xhr.open("GET", url, true);
	xhr.send();

	//3.Get the response
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4 && xhr.status == 200) {
            //JSON in text format
			var jsonText = xhr.responseText;

			//Convert text to object JSON
			jsonObjectParkings = JSON.parse(jsonText);

            //Extracting parkings information
            for (var count=0; count < jsonObjectParkings.results.length; count++){

                //Info
                object = jsonObjectParkings.results[count];
                parking.geometry.coordinates = object.geo_shape.geometry.coordinates;
                parking.properties.name = object.nombre;
                parking.properties.total_parking = object.plazastota;
                parking.properties.free_parking = object.plazaslibr;
                parking.properties.last_update = object.ultima_mod;

                //Save parking
                parkingArray.push(JSON.parse(JSON.stringify(parking)));
            }
            //Show nearby parking lots - update each 2s
            if (showParkingInterval === null){
                showParkingInterval = setInterval(drawParking, 2000);//2seg
            }
        }
    }
}




//Obtaining the nearest parking spaces at each new position our
function nearParking(){

    //init
    var  nearParkingArray = [];

    //Check  there are coordinates
    if (currentPosition.geometry.coordinates.length === 0 || parkingArray.length === 0){
        return nearParkingArray;
    }

    //Distance calculation
    parkingArray.forEach((parkingJSON) => {//parkingJSON.geometry.coordinates = [lng, lat]

        //Calculate distance between current position and parkings
        var squareDistance = calculateDistance(parkingJSON.geometry.coordinates, currentPosition.geometry.coordinates)

        //Nearby?
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
        iconAnchor: [15, 15], //central point
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
    popup +="<div class='btn'><button type='button' class='btn_navigation' onclick='onlySelectedParkingOnMap()'>Get a route to parking?</button></div>";
    popup += "</div>";

    return [popup, parkingIcon];
}



//------Show nerby parkings------
function drawParking(){

    //Check there are parkings on map
    if (leafletParkingsIdArray.length !== 0){

        //Distance calculation between our position at instant t and t+1
        var distance = calculateDistance(initialPosition.geometry.coordinates, currentPosition.geometry.coordinates);

        //Update nearby parking lots on the map only when our position changes by 50 m from the previous one
        if (distance <= 2500){
            return;
        }
    }

    //Update initial position coordinates
    initialPosition.geometry.coordinates = currentPosition.geometry.coordinates;

    //Clear map leaflet each new user position
    if (leafletParkingsIdArray.length !== 0){
        for (var count = 0; count < leafletParkingsIdArray.length; count++){
            map.removeLayer(leafletParkingsIdArray[count]);
        };
    }

    //Reset global variable value
    leafletParkingsIdArray = [];

    //------Get nearby parkings------
    var nearParkingArray = nearParking();

    //Check there are points
    if (nearParkingArray.length === 0){

        //REVISAR ESTA TOSTADA PARA QUE SOLO SE MUESTRE EN CASO DE NO TENER PARKINGS CERCANOS
        //showToast("There are no nearby parking facilities.");
        document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "black";
        return;
    }
    //Draw points
    nearParkingArray.forEach((parking) => {
        //Popup and style icon
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
        leafletPointID.on('click', onClickParking);

        //Add point to map
        leafletPointID.addTo(map);

        //Add pointID to leafletParkingsIdArray
        leafletParkingsIdArray.push(leafletPointID);
    })

    //Change search icon color
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "cyan";
}



//------Show current position------
function drawCurrentPosition(compassAngle){

    //Popup and style icon
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

    //Add point to map
    leafletCurrentPositionId.addTo(map);

    //REVISAR ANTES DE ENTREGA FINAL
    //Zoom to current position
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

    //--------------Clear map leaflet--------------
    //Remove all parkings
    for (var count = 0; count < leafletParkingsIdArray.length; count++){
        map.removeLayer(leafletParkingsIdArray[count]);
    }
    leafletParkingsIdArray = [];

    //Remove the current position
    map.removeLayer(leafletCurrentPositionId);
    leafletCurrentPositionId = null;

    //Remove route
    if (leafletRouteId !== null) {
        map.removeLayer(leafletRouteId);
        leafletRouteId = null;
    }

    //--------------Routing--------------
    selectedParkingObject = null;
    routeDictionary = {};



    //--------------Clear timeout and intervals--------------
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

    //Show/Hide HTML elements
    showHideElements();

    //Change icon color
    document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "black";
    document.getElementsByClassName("fa-solid fa-magnifying-glass")[0].style.color = "black";

    return clearMemory;
    //return buttonIndex;
}






















//------------------------------------------------------------------------------------------------------------
//-----------------------------------------------Cordova Plugins----------------------------------------------
//------------------------------------------------------------------------------------------------------------

//------------------------------------Compass cordova------------------------------------

//Get the current heading
function onSuccessCompass(heading) {

    //Compass value
    var compassAngle = -45 + heading.magneticHeading;

    //Drawing for the first time our position
    if (leafletCurrentPositionId === null && currentPosition.geometry.coordinates.length !==0){
        drawCurrentPosition(compassAngle);
    }
    else if (leafletCurrentPositionId){

        //Update the icon orientation of the current position
        var customIcon = getCustomCurrentPositionIcon(compassAngle);
        icon = customIcon[1];
        leafletCurrentPositionId.setIcon(icon);
    }
}


//Failed to get the heading
function onErrorCompass(error) {

    //Reset default value
    watchCompassID=null;

    //Error case evaluation
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
    //Cordova-plugin-notification
    navigator.notification.alert(message,
                                function (){},//callback anonymous function
                                "GeoParkings", //title
                                "Ok"//name of option
                            );
}
function showConfirm(message){
    //Cordova-plugin-notification
    navigator.notification.confirm(message,
                                onConfirm,//callback function
                                "GeoParkings", //title
                                ["OK","Cancel"]//name of options -> user bottoms. Ok=1, Cancel=2
                            );
}

//Callback function to confirm a user action
function onConfirm(buttonIndex){
    return buttonIndex;
    //if (buttonIndex == 1){
    //    console.log("Confirm");
    //}
}









//------------------------------------------------------------------------------------------------------------
//-------------------------------------------------Navigation-------------------------------------------------
//------------------------------------------------------------------------------------------------------------

//Capture of the coordinates of the selected parking lot
function onClickParking(marker) {

    //Update global variables
    selectedParkingObject = marker;
}




function onlySelectedParkingOnMap(){

    //Ask if you want to start searching for a route
    var searchRoute = confirm("Do you want to find a route to the selected parking lot?");
    if (!searchRoute) {
        return;
    }

    /*//Cordova
    //Ask to find a route
    var searchRoute = onConfirm("Do you want to find a route to the selected parking lot?");
    if (searchRoute === 2){//Cancel
        return
    }*/

    //Check that the leaflet object has been obtained from the selected parking lot.
    if (selectedParkingObject === null && leafletParkingsIdArray.length === 0){
        showToast("It was not possible to obtain a route.");
        return;
    }

    //Stop drawing parkings
    if (showParkingInterval !== null) {
        clearInterval(showParkingInterval);
        showParkingInterval = null;
    }

    //Show on map only parking selected and current position
    var idSelectedParking = selectedParkingObject.sourceTarget._leaflet_id;

    //Remove all unselected parking lots from the map
    leafletParkingsIdArray = leafletParkingsIdArray.filter(parking => {
        if (parking._leaflet_id !== idSelectedParking) {
            map.removeLayer(parking);
            return false; //exclusion from the leafletParkingsIdArray
        }
        return true;//keep on the leafletParkingsIdArray
    });

    //Get coordinates of selected parking
    var selectedParkingCoords = [selectedParkingObject.latlng.lat, selectedParkingObject.latlng.lng];

    //Find a optimal route
    findRoute(selectedParkingCoords);
}






//GET request for a route with the OSRM router
function findRoute(selectedParkingCoords) {

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
        callback = function (error, routes) {

            //In case of error in the GET request
            if (error) {
                showToast("Error when searching for the route: " + error);
                return;
            }
            //Route found
            var routeObject = routes[0];

            //Process the route after obtaining it
            processRoute(routeObject);
        }
    );
}


//Organizing route information in the form of a dictionary
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

    //Get route vertices with instructions
    for (var count = 1; count < routeInstructions.length; count++){

        //Start and end indexes
        var start = routeInstructions[count-1].index;
        var end = routeInstructions[count].index;

        //Get segment coordinates [[lat, lng], ... ,[lat_n, lng_n]]
        var segmentCoordsArray = routeCoordinates.slice(start, end).map(coord => [coord.lat, coord.lng]);

        //Get instruction and add the corresponding coordinates
        var instruction = routeInstructions[count-1];
        instruction.coords = segmentCoordsArray;

        //Update global variable
        routeDictionary[count-1] = instruction;
    }

    //End instruction
    var start = routeInstructions[routeInstructions.length-2].index;
    var end = routeInstructions[routeInstructions.length-1].index;
    var segmentCoordsArray = routeCoordinates.slice(start, end).map(coord => [coord.lat, coord.lng]);
    var instruction = routeInstructions[routeInstructions.length-1];
    instruction.coords = segmentCoordsArray;

    //Update global varieble
    routeDictionary[routeInstructions.length-1] = instruction;
    //console.log(JSON.stringify(routeDictionary, undefined, 4));
    drawRoute();
    console.log(routeSummary);
}


//Drawing a optimal route
function drawRoute() {

    //Check there are instructions
    if (Object.keys(routeDictionary).length === 0) {
        showToast("It was not possible to obtain a route.");
        return;
    }

    //Get segment coords
    var latlngs =[];
    Object.entries(routeDictionary).forEach(([key, value]) => {
        latlngs.push(value.coords);
    });

    //Remove before redrawing
    if(leafletRouteId !== null){
        map.removeLayer(leafletRouteId);
    }
    //Create multipolyline leaflet
    leafletRouteId = L.polyline(latlngs, drawRouteOptions).addTo(map);

    //Show/Hide HTML elements
    showHideElements();
}



function startNavigation(){

    //Ask if you want to start navigation on route
    var startNavigation = confirm("Do you want to start navigating the found route?");
    if (!startNavigation) {

        //Remove the route  and selected parking from the map
        map.removeLayer(leafletRouteId);
        map.removeLayer(leafletParkingsIdArray[0]);

        //Reset global variable
        selectedParkingObject = null;
        leafletRouteId = null;

        //Show/Hide HTML elements
        showHideElements();

        //Start again the search for nearby parking lots
        findParkings();
    }
    return;

    // Ajustar el zoom del mapa para mostrar todas las líneas
    //map.fitBounds(leafletRouteId.getBounds());

    /*var a = 0; // Start with the first segment
    setTimeout(() => {
        var intervalId = setInterval(() => {
            if (latlngs.length === 0 || a >= latlngs.length) {
                // Stop the interval if no more segments
                clearInterval(intervalId);
                console.log("No more segments to remove.");
                return;
            }

            // Remove one segment and update the polyline
            latlngs.splice(a, 1);
            leafletRouteId.setLatLngs(latlngs);

            console.log(`Segment ${a} removed. Remaining segments:`, latlngs);
        }, 5000);
    }, 2000);
    */

}







//------------------------------------------------------------------------------------------------------------
//------------------------------------------Miscellaneous functions-------------------------------------------
//------------------------------------------------------------------------------------------------------------

function initApp(){

    //Init-Get HTML elements
    var divMap = document.getElementById("map");
    var divMenu = document.getElementById("menu");
    var divCoordinates = document.getElementById("coordinates");
    var divNavButton = divMenu.querySelector(".fa-solid.fa-route");
    var divInitialScreen = document.getElementById("initial-screen-container");

    //Hide HTML elements
    divMap.style.display = "None";
    divMenu.style.display = "None";
    divCoordinates.style.display ="None";
    //divNavButton.style.display ="None";

    //After 4 seconds the second screen is displayed (map and menu)
    setTimeout(() => {
        //Hide initial screen
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




//Show or hide HTML elements
function showHideElements(){

    //Init-Get HTML elements
    var divMenu = document.getElementById("menu");
    var divCoordinates = document.getElementById("coordinates");
    var textCoordinates = document.getElementById("coordinates-text");
    var divNavButton = divMenu.querySelector(".fa-solid.fa-route");

    //-----------------Show and hide coordinates bar-----------------
    if(currentPosition.geometry.coordinates.length === 0){
        //Hide coordinates
        divCoordinates.style.opacity = "0";
        textCoordinates.style.opacity = "0";
        divNavButton.style.opacity = "0";

        //Set transform
        setTimeout(() =>{
            divCoordinates.style.display = "none";
            divNavButton.style.display = "none";
            divMenu.style.height = "110px";
            divMenu.style.transform = "translateY(-18%)";
            document.getElementById("coordinates-text").innerHTML = "";
        }, 1000);
    }
    else{
        //Set transform
        divMenu.style.transform = "translateY(-50%)";

        //Show coordinates
        setTimeout(() =>{
            divCoordinates.style.display = "block";
            setTimeout(()=>{
                divCoordinates.style.opacity = "1";
                textCoordinates.style.opacity = "1";
            },500);
        },500);
    }

    //-----------------Show and hide navigation button-----------------
    if(leafletRouteId !== null){

        divMenu.style.height = "170px";
        divMenu.style.transform = "translateY(-28%)";

        divNavButton.style.display = "block";
        setTimeout(() =>{
            divNavButton.style.opacity = "1";
        }, 500);
    }
    else{
        if(currentPosition.geometry.coordinates.length !== 0){
        divNavButton.style.opacity = "0";
        divNavButton.style.display = "none";
        divMenu.style.height = "110px";
        divMenu.style.transform = "translateY(-50%)";
        }
    }
}





//Toast
function showToast(message){

    var toast = document.getElementById("toast");

    //Show toast
    toast.innerHTML = message;
    toast.style.opacity= "1";

    //Hide toast
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
    //Update coordinates format
    formatCoordinates();
}



//Conversion between coordinate systems
function geoToUTM(geoPoint){//geopoint=[lng, lat]

    //Get UTM zone
    var longitude = geoPoint[0];
    var zone = 1 + Math.floor((longitude+180)/6);//source: https://stackoverflow.com/questions/29655256/proj4js-can-you-convert-a-lat-long-to-utm-without-a-zone

    //From geo to utm
    //Origin and target CRSs
    proj4.defs("UTM", "+proj=utm +zone=" + zone.toString() + "+ellps=GRS80 +units=m +no_defs"); //+no_defs: no default value
    proj4.defs("EPSG:4326", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");

    //Convert to utm coordinates
    var utmPoint = proj4(proj4("EPSG:4326"), proj4("UTM"), geoPoint);

    return [utmPoint, zone];
}


//Calculation of the Euclidean distance between two points
function calculateDistance(pto1Coords, pto2Coords){//[lng, lat], [lng, lat]

    //Check there are coordinates
    if (pto1Coords.length === 0 && pto2Coords.length === 0){
        return;
    }

    //UTM coordinates pto1
    var utmPto1 = geoToUTM(pto1Coords)[0];//[x,y]
    var XutmPto1 = utmPto1[0];
    var YutmPto1 = utmPto1[1];

    //UTM coordinates pto2
    var utmPto2 = geoToUTM(pto2Coords)[0];//[x,y]
    var XutmPto2 = utmPto2[0];
    var YutmPto2 = utmPto2[1];

    //Distance calculation
    var squareDistance = Math.pow(XutmPto1 - XutmPto2, 2) + Math.pow(YutmPto1 - YutmPto2, 2);

    return squareDistance;
}



//Change the current format coordinates
function formatCoordinates(){

    //Check there are coordinates
    if (currentPosition.geometry.coordinates.length === 0){
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
        //Coordinates with 8 decimals
        //Output
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
        //Conversion
        var degrees = Math.floor(longitude);
        var minutes = Math.floor((longitude - degrees) * 60);
        var seconds = ((longitude - degrees) * 60 - minutes) * 60;

        //Number to string
        degrees = degrees.toString();
        minutes = minutes.toString();
        seconds = seconds.toFixed(3).toString(); // 3 decimals

        //Format DDº MM' SS.SSS"
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
        //Conversion
        degrees = Math.floor(latitude);
        minutes = Math.floor((latitude - degrees) * 60);
        seconds = ((latitude - degrees) * 60 - minutes) * 60;

        //To string
        degrees = degrees.toString();
        minutes = minutes.toString();
        seconds = seconds.toFixed(3).toString(); //3 decimals

        //Format DDº MM' SS.SSS"
        if (degrees.length < 2){ degrees = degrees.padStart(2,0); }
        if (minutes.length < 2){ minutes = minutes.padStart(2,0); }
        if (seconds.split(".")[0].length < 2){ seconds = seconds.padStart(6,0); }

        latitude = degrees + "\u{00B0}" + minutes + "\u{0027}" + seconds + "\u{0022}" + hemisphere;

        //Output
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

        //Coordinate conversion
        var utmPoint_zone = geoToUTM(geoPoint);
        var utmPoint = utmPoint_zone[0];
        var zone = utmPoint_zone[1];

        var xUTM = utmPoint[0].toFixed(3).toString();
        var yUTM = utmPoint[1].toFixed(3).toString();

        //Output
        coordinatesString += zone;
        coordinatesString += separator;
        coordinatesString += xUTM;
        coordinatesString += separator;
        coordinatesString += yUTM;
        coordinatesString += separator;
        coordinatesString += "[" + accuracy.toFixed(2) + "]";
    }
    //Output
    document.getElementById("coordinates-text").innerHTML = coordinatesString;
}

