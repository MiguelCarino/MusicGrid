// Function to fetch video details
function fetchVideoDetails(album) {
    const API_KEY = 'AIzaSyCmtV8QIecdM2A-5YCGRPanLqIsOIjoV74'; // Replace with your YouTube Data API key
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
    const spotifyUrl = `https://open.spotify.com/track/${album.spotifyurl}`;
    const applemusicUrl = `https://music.apple.com/${album.applemusicurl}`;

    // Clear previous content
    albumImageDiv.innerHTML = '';
    videoTitleDiv.innerHTML = '';
    videoLinksDiv.innerHTML = '';
    videoPlayerDiv.innerHTML = '';

    // Create and append new elements
    const albumImage = document.createElement('img');
    albumImage.src = `assets/covers/${album.image}`;
    albumImage.alt = details.title;
    albumImageDiv.appendChild(albumImage);

    const titleDiv = document.createElement('div');
    titleDiv.className = 'video-title';
    titleDiv.innerHTML = `<b>${details.title}</b>`;
    videoTitleDiv.appendChild(titleDiv);

    const linksPara = document.createElement('p');
    linksPara.innerHTML = `
        Listen on:<br>
        <a href="${videoUrl}" target="_blank"><b>YouTube</b></a>
        <br>
        <a href="${videoUrlInvidious}" target="_blank"><b>Invidious</b></a>
        <br>
        <a href="${spotifyUrl}" target="_blank"><b>Spotify</b></a>
        <br>
        <a href="${applemusicUrl}" target="_blank"><b>Apple Music</b></a>
    `;
    videoLinksDiv.appendChild(linksPara);

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${album.url}?autoplay=1`;
    iframe.frameborder = "0";
    iframe.allowfullscreen = true;
    videoPlayerDiv.appendChild(iframe);

    // Check screen width and hide the album image on mobile
    if (window.innerWidth <= 768) {
        albumImageDiv.style.display = 'none'; // Hide the album image div for mobile
    } else {
        albumImageDiv.style.display = 'block'; // Ensure the album image is shown on desktop
    }

    // Add the 'show' class to trigger the animation
    videoInfoBar.classList.add('show');
}

document.addEventListener("DOMContentLoaded", function() {
    const musicgrid = document.getElementById('musicgrid');

    if (!musicgrid) {
        console.error('MusicGrid element not found.');
        return;
    }

    let player; // This will hold our YouTube player
    //Set different speeds for gecko and blink browsers
    function getScrollSpeed() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes("Firefox")) {
            return 3; // Speed for Firefox
        } else if (userAgent.includes("Chrome")) {
            return 1; // Speed for Chrome
        } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
            return 1; // Speed for Safari (WebKit)
        }
        return 2; // Default speed for other browsers
    }
    
    // Function to slowly scroll the grid downwards
    function autoScroll() {
        const scrollSpeed = getScrollSpeed(); // Call the function to get the speed
        musicgrid.scrollTop += scrollSpeed;
    }
    
    // Call autoScroll function every 50 milliseconds (adjust the interval as needed)
    setInterval(autoScroll, 50);
    

    function addCell(album) {
        const musiccell = document.createElement('div');
        musiccell.className = 'cell';
        musiccell.style.backgroundImage = `url(assets/covers/${album.image})`;
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

        for (let i = 0; i < 170; i++) {
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
});
