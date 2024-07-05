const albums = [{url: 'dQw4w9WgXcQ',image: 'mu_1.webp'
},{url: 'pO6PKohD3eM',image: 'mu_2.webp'
},{url: 'pO6PKohD3eM',image: 'mu_3.webp'
},{url: 'pO6PKohD3eM',image: 'mu_4.webp'
},{url: 'pO6PKohD3eM',image: 'mu_5.webp'
},{url: 'pO6PKohD3eM',image: 'mu_6.webp'
},{url: 'pO6PKohD3eM',image: 'mu_7.webp'
},{url: 'pO6PKohD3eM',image: 'mu_8.webp'
},
// add more albums here
];

// Function to fetch video details
function fetchVideoDetails(album) {
const API_KEY = 'AIzaSyCxJJiioJa44xJ8OA9jrLNKqmTBblZlArc'; // Replace with your YouTube Data API key
const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${album.url}&key=${API_KEY}`;

fetch(url)
.then(response => response.json())
.then(data => {
    if (data.items.length > 0) {
        const videoDetails = data.items[0].snippet;
        console.log("Video Details:", videoDetails); // Check videoDetails object
        console.log("Album Image:", album.image); // Check album object
        displayVideoInfo(videoDetails, album); // Pass album to displayVideoInfo
    } else {
        console.log("No video details found.");
    }
})
.catch(error => console.error('Failed to fetch video details:', error));
}

// Function to display video details in your page
function displayVideoInfo(details, album) {
const videoInfoDiv = document.getElementById('videoInfo');
const videoUrl = `https://www.youtube.com/watch?v=${album.url}`;
const videoUrlInvidious = `https://redirect.invidious.io/watch?v=${album.url}`;

videoInfoDiv.innerHTML = `
<style>
.container {
display: flex;
flex-wrap: wrap;
max-width: 55%; //It is globally defined in main.css
}

.column {
flex: 1;
padding: 5px;
box-sizing: border-box;
vertical-align: center;
}

@media (max-width: 600px) {
.column {
flex: 100%;
max-height: 12em;
font-size: 17px;
}
}
</style>
<div class="container">
<div class="column">
<img src="images/${album.image}" style="max-height: 10em;"></img>
</div>
<div class="column">
<p style="font-size: 26px;">Now playing - <b>${details.title}</b>
</div>
<div class="column">
<br>Play on <a href="${videoUrl}" target="_blank"><b>YouTube</b></a>
<br>Play on <a href="${videoUrlInvidious}" target="_blank"><b>Invidious</b></a></p>
</div>
</div>
<div class="container">
<div class="column">
    
</div>
<div class="column" style="font-size: 18px;">
    
</div>
</div>                
`;
}

const musicgrid = document.getElementById('musicgrid');
let player; // This will hold our YouTube player

// This function creates an iframe (YouTube player) after the API code downloads.
function onYouTubeIframeAPIReady() {
player = new YT.Player('youtubePlayer', {
    height: '750em', // Adjust the size as needed
    width: '60%',
    videoId: '', // Initial video ID (can be empty or any valid YouTube video ID)
    events: {
        'onReady': onPlayerReady,
        // 'onStateChange': onPlayerStateChange,
    }
});
}
// Function to slowly scroll the grid downwards
function autoScroll() {
const scrollSpeed = 4; // Adjust the speed as needed
musicgrid.scrollTop += scrollSpeed;
}

// Call autoScroll function every 50 milliseconds (adjust the interval as needed)
setInterval(autoScroll, 50);

function onPlayerReady(event) {
// Player is ready. You can set up additional options here.
}

function addCell(album) {
const musiccell = document.createElement('div');
musiccell.className = 'cell';
musiccell.style.backgroundImage = `url(images/${album.image})`;
musiccell.onclick = function() {
    fetchVideoDetails(album); // Fetch and display video details
    player.loadVideoById(album.url);
    document.getElementById('youtubePlayerContainer').style.display = 'inline';
};
musicgrid.appendChild(musiccell);
}

function closePlayer() {
document.getElementById('youtubePlayerContainer').style.display = 'none';
player.stopVideo(); // Stops the video when closing the player
}

function shuffle(array) {
for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
}
return array;
}

function populateGrid() {
let shuffledAlbums = shuffle([...albums]); // Create a shuffled copy of the albums array

for (let i = 0; i < 60; i++) {
    if (i % albums.length === 0) {
        shuffledAlbums = shuffle([...albums]); // Re-shuffle after every full cycle
    }
    addCell(shuffledAlbums[i % albums.length]);
}
}

function checkScroll() {
if (musicgrid.scrollTop + musicgrid.clientHeight >= musicgrid.scrollHeight) {
    populateGrid();
}
}

populateGrid();
musicgrid.addEventListener('scroll', checkScroll);

// Load the YouTube Iframe API script asynchronously
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);