// Function to fetch video details
function fetchVideoDetails(album) {
    const API_KEY = 'AIzaSyCxJJiioJa44xJ8OA9jrLNKqmTBblZlArc'; // Replace with your YouTube Data API key
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${album.url}&key=${API_KEY}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.items.length > 0) {
                const videoDetails = data.items[0].snippet;
                displayVideoInfo(videoDetails, album); // Pass album to displayVideoInfo
            } else {
                console.log("No video details found.");
            }
        })
        .catch(error => console.error('Failed to fetch video details:', error));
}

// Function to display video details in your page
function displayVideoInfo(details, album) {
    const albumImageDiv = document.getElementById('albumImage');
    const videoTitleDiv = document.getElementById('videoTitle');
    const videoLinksDiv = document.getElementById('videoLinks');
    const videoPlayerDiv = document.getElementById('videoPlayer');
    const videoUrl = `https://www.youtube.com/watch?v=${album.url}`;
    const videoUrlInvidious = `https://redirect.invidious.io/watch?v=${album.url}`;

    albumImageDiv.innerHTML = `<img src="images/${album.image}" alt="${details.title}">`;
    videoTitleDiv.innerHTML = `<div class="video-title"><b>${details.title}</b></div>`;
    videoLinksDiv.innerHTML = `
        <p>
            <a href="${videoUrl}" target="_blank"><b>YouTube</b></a>
            <br>
            <a href="${videoUrlInvidious}" target="_blank"><b>Invidious</b></a>
        </p>
    `;
    videoPlayerDiv.innerHTML = `<iframe src="https://www.youtube.com/embed/${album.url}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;

    document.getElementById('videoInfoBar').classList.add('show'); // Show the info bar
}

const musicgrid = document.getElementById('musicgrid');
let player; // This will hold our YouTube player

// Function to slowly scroll the grid downwards
function autoScroll() {
    const scrollSpeed = 4; // Adjust the speed as needed
    musicgrid.scrollTop += scrollSpeed;
}

// Call autoScroll function every 50 milliseconds (adjust the interval as needed)
setInterval(autoScroll, 50);

function addCell(album) {
    const musiccell = document.createElement('div');
    musiccell.className = 'cell';
    musiccell.style.backgroundImage = `url(images/${album.image})`;
    musiccell.onclick = function() {
        fetchVideoDetails(album); // Fetch and display video details
    };
    musicgrid.appendChild(musiccell);
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

    for (let i = 0; i < 155; i++) {
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
