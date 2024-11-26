
//====================================================================================================================
//===========================================Global variables=========================================================
//====================================================================================================================

//null = geolocation disable
//not null = geolocation enable
var watchID = null;

//GeoJSON of points
var point ={
    "id": null,
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": []
    },
    "properties": {}
}

//positioning options (high to lower precision)
//1-) GPS receiver  2-) Wifi  3-) IP Adress
var geolocationOptions = {
    enableHighAccuracy: true, //GPS
    Timeout: 10000 //10seg
}

//Store points
var pointArray = [];


//Base Map
var map = L.map("map", {zoomControl: false}); //L: madre de todos los objetos de leaflet

//Leaftlet Layers
//1. Tile Map Server (TMS) - Open StreetMap
var osmURL = "https://{s}.tile.osm.org/{z}/{x}/{y}.png"; //s: servidor, z: nivel de zoom, x:columnas y:filas
//2. Attribution -> creditos al autor
var osmAtt = "&copy; <a href=\"https://openstreetmap.org/copyright\"> OpenStreetMap </a> contributors"; //&copy: simbolo de copyright en html
//3. Add ayer
var osm = L.tileLayer(osmURL, {attribution: osmAtt});
//show Map
map.setView([0.0, 0.0], 1); //[0,0]: screen center, 1: nivel de zoom
//add Layer to view
map.addLayer(osm);
//Layer points
var leafletPointOptions = {
    radius: 20,//depende del dispositivo movil
    color: "blue",
    fillOpacity: 0.8
};
var leafletPointArray = [];// Save leaflet IDs of entities

//Multilayer
var currentLayer = "osm";

//wms
var pnoa = L.tileLayer.wms(
    "http://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&",
    {layers: "OI.OrthoimageCoverage", tranparent: true,
    format: "image/jpeg", version: "1.3.0", attribution: "&copy; CNIG"
    }
);

var baseMaps = {"osm": osm, "pnoa": pnoa};


//Format coordinates
var format = "geo";

//====================================================================================================================
//=========================================End global variables=======================================================
//====================================================================================================================




//initial point for cordova apps
function onDeviceReady(){
    //Click events similar to onclick but in JS

    document.getElementsByClassName("fa-solid fa-location-dot")[0].addEventListener("click", toggleLocation);
    document.getElementsByClassName("fa-solid fa-keyboard")[0].addEventListener("click", toggleIDBox);
    document.getElementsByClassName("fa-solid fa-square-plus")[0].addEventListener("click", storePoint);
    document.getElementsByClassName("fa-solid fa-square-minus")[0].addEventListener("click", clearMemory);
    document.getElementsByClassName("fa-solid fa-layer-group")[0].addEventListener("click", switchBaseMap);
    document.getElementsByClassName("fa-solid fa-floppy-disk")[0].addEventListener("click", saveToGeoJSON);

    //lab4
    document.getElementById("coordinates").addEventListener("click", () => {
        if (format == "geo") {
            format = "dms";
        } else if (format == "dms") {
            format = "utm";
        } else if (format=="utm"){
            format = "geo";
        }
        //update format coordinates
        formatCoordinates();
    });
}






//====================================================================================================================
//===============================================Geolocation==========================================================
//====================================================================================================================

function getLocation(){
    //Check browser support
    if (navigator.geolocation){//navigator.geolocation != undefined
        //alert("Geolocation service available.");
        showToast("Geolocation service available.");

        navigator.geolocation.getCurrentPosition(geolocationSucess, geolocationError, geolocationOptions);

    }else{
        alert("Geolocation service not supported.");
    }
}






function formatCoordinates(event){
    //Check there are coordinates
    if (point.geometry.coordinates[0] == undefined){
        alert("Collect coordinates before change format.");
        return;
        }

    //Init
    var separator ="&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"; //&nbsp; = blank space in html
    var coordinatesString = "";
    var latitude = point.geometry.coordinates[1];
    var longitude = point.geometry.coordinates[0];
    var accuracy = point.properties.accuracy;

    //--------------------------format geo--------------------------
    if (format == "geo"){
        //coordinates with 8 decimals
        //output
        coordinatesString += latitude.toFixed(8);
        coordinatesString += separator;
        coordinatesString += longitude.toFixed(8);
        coordinatesString += separator;
        coordinatesString += "[" + accuracy.toFixed(2) + "]";
    }
    //--------------------------format dms--------------------------
    else if (format == "dms"){
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
    else if (format == "utm"){
        // Init
        var geoPoint=[longitude, latitude];
        var zone = 1 + Math.floor((longitude+180)/6); // source: https://stackoverflow.com/questions/29655256/proj4js-can-you-convert-a-lat-long-to-utm-without-a-zone

        //From geo to utm
        // 1.Origin and target CRSs
        // Parameter 1: alias
        // Parameter 2: CRS definition
        proj4.defs("UTM", "+proj=utm +zone=" + zone.toString() + "+ellps=GRS80 +units=m +no_defs"); //+no_defs: no se aplicará ningun valor por defecto
        proj4.defs("EPSG:4326", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");

        // 2.Convert to utm coordinates
        //Parameter 1: origin CRS
        //Parameter 2: target CRS
        //Parameter 3: point to be transformed
        var utmPoint = proj4(proj4("EPSG:4326"), proj4("UTM"), geoPoint);

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

    //update global variable
    coordinatesString = "";
}









function geolocationSucess(position){
    //fill a var point (geojson)
    point.geometry.coordinates = [position.coords.longitude, position.coords.latitude];

    //geolocation accuracy
    point.properties.accuracy = position.coords.accuracy;

    //date = timestamp
    point.properties.timestamp = position.timestamp;

    //out
    console.log(JSON.stringify(point, null, 4));
    formatCoordinates();
}





function geolocationError(error){

    //structure switch-case
    switch(error.code){

        case error.PERMISSION_DENIED:
            //alert("geolocation request denied.");
            showToast("geolocation request denied.");
            break;

        case error.POSITION_UNAVAILABLE:
            //alert("position unavailable.");
            showToast("position unavailable.");
            break;

        case error.TIMEOUT:
            //alert("geolocation request timed out.");
            showToast("geolocation request timed out.");
            break;

        case error.UNKNOWN_ERROR:
            //alert("unknown geolocation error.");
            showToast("unknown geolocation error.");
            break;
    }
}



//each x seconds get a position.
function toggleLocation(){

    if (watchID === null){
        //Start Geolocation
        showToast("Starting geolocation service.");
        watchID = navigator.geolocation.watchPosition(geolocationSucess, geolocationError, geolocationOptions);

        //change icon color
        document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "cyan";
    }else{
        //Stop Geolocation
        showToast("Stopping geolocation service.");
        navigator.geolocation.clearWatch(watchID)// clean geolocation
        watchID=null;
        //change icon color
        document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "black";
    }
}
//====================================================================================================================
//=============================================End Geolocation========================================================
//====================================================================================================================






//====================================================================================================================
//===============================================User Input===========================================================
//====================================================================================================================

function toggleIDBox(){
    //get tag html
    var pointID = document.getElementById("point-id");

    //Check visibility of IDBox
    if (pointID.style.display == "none"){ //invisible
        pointID.style.display = "block"; //make it visible

    }else if (pointID.style.display == "block"){
        pointID.style.display = "none"
    }
}
//====================================================================================================================
//=============================================End user Input=========================================================
//====================================================================================================================



//Toast, better than alert
function showToast(message){
    var toast = document.getElementById("toast");
    toast.innerHTML = message;
    toast.style.display = "block";
    setTimeout(function(){toast.style.display = "none";},5000); //5seg
}





//====================================================================================================================
//=========================================Store point in memory======================================================
//====================================================================================================================
function storePoint(){
    //alert("storePoint()");

    //Check  there are coordinates
    if (point.geometry.coordinates[0] === null || point.geometry.coordinates[1] === null){
            /*
                ==  check only value of variable
                === check value and type of variable
                || OR logical operator
                && AND logical operator
            */
        alert("Collect coordinates before saving.");
        return;
    }

    //Counter in string format
    var counterPointID = ("0000" + pointArray.length.toString()).substring(-4);
    //console.log(counterPointID);

    //Point ID from text box
    var pointIDText = document.getElementById("point-id-text");

    if (pointIDText.value.trim() === "") {
        //trim(): removes blank spaces at the beginning and end of the string (python strip())
        var pointIDValue = counterPointID;
        point.id = counterPointID;

    }else{
        var pointIDValue = pointIDText.value.trim();
        point.id = pointIDValue;
    }

    //Properties: Point Counter
    point.properties.count = counterPointID;

    //Append current feature to point array as JSON (json -> string -> json)
    pointArray.push(JSON.parse(JSON.stringify(point)));

    // Reset text box
    pointIDText.value = "";

    // Hidden text box
    var pointID = document.getElementById("point-id");
    if (pointID.style.display == "block"){
        pointID.style.display = "none"
    }




    // Draw point
    //1 . Marker
    var leafletPointID = L.circle(
        point.geometry.coordinates.toReversed(),
        leafletPointOptions);

    // 2. Popup
    var popup = "";
    popup += "ID = " + point.properties.count + '<br>'; //'<br>' porque el popup es código html
    popup += "Longitude = " + point.geometry.coordinates[0].toFixed(8) + '<br>';
    popup += "Latitude = " + point.geometry.coordinates[1].toFixed(8) + '<br>';

    // 3. Link popup
    leafletPointID.bindPopup(popup);

    // 4. Add point to map
    leafletPointID.addTo(map);

    // 5. add pointID to pointArray
    leafletPointArray.push(leafletPointID);

    // 6. zoom to point
    map.setView(point.geometry.coordinates.toReversed(), 14);
}
//====================================================================================================================
//=======================================End Store point in memory====================================================
//====================================================================================================================











//====================================================================================================================
//=============================================Clear Memory===========================================================
//====================================================================================================================
function clearMemory(){
    //alert("clearMemory()");

    // Check there are data to clear
    if (pointArray.length == 0){
        alert("There are no data collected yet.");
        return;
    }

    // Ask to clear memory
    var clearMemory = confirm("All collected data will be removed. Proceed?");
    //console.log(clearMemory);

    if (!clearMemory){
        //! : NOT operator
        return;
    }

    // Clear memory
    pointArray = [];
    var point ={
        "id": null,
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": []
        },
        "properties": {}
    }

    //Clear map leaflet
    //Remove points
    for (var count = 0; count < leafletPointArray.length; count++){
        map.removeLayer(leafletPointArray[count]);
    }
    leafletPointArray = [];
}
//====================================================================================================================
//===========================================End Clear Memory=========================================================
//====================================================================================================================







//====================================================================================================================
//===========================================Switch base map==========================================================
//====================================================================================================================
function switchBaseMap(){
    //alert("switchBaseMap()");
    if(currentLayer == "osm"){
        map.removeLayer(baseMaps["osm"]);
        map.addLayer(baseMaps["pnoa"]);
        currentLayer = "pnoa";

    }else if (currentLayer == "pnoa"){
        map.removeLayer(baseMaps["pnoa"]);
        map.addLayer(baseMaps["osm"]);
        currentLayer = "osm";
    }
}
//====================================================================================================================
//=========================================End Switch base map========================================================
//====================================================================================================================





//====================================================================================================================
//=============================================Save GeoJSON===========================================================
//====================================================================================================================
function saveToGeoJSON(){
    //alert("saveToGeoJSON()");

    // Check there are data to save
    if (pointArray.length == 0){
        alert("There are no data collected yet.");
        return;
    }

    var geoJSON ={
        type: "FeatureCollection",
        features: pointArray
    };

    //console.log(JSON.stringify(geoJSON, null, 4));

    //FileName

    //Save to physical device: Cordova
}
//====================================================================================================================
//===========================================End Save GeoJSON=========================================================
//====================================================================================================================








//additional function to center the map on the current location
function centerMap(){
    //alert("centerMap");

    //check geolocation
    if (point.geometry.coordinates.length === 0){
        showToast("Geolocation not available.");
        return;
    }
    //zoom to current location
    map.setView(point.geometry.coordinates.toReversed(), 16); //toTeversed() para cambiar el orden de las coordenadas
}







