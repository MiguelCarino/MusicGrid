// Dynamically add the Font Awesome CSS
    const faLink = document.createElement('link');
    faLink.rel = 'stylesheet';
    faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(faLink);
    const style = document.createElement('style');
    style.textContent = `
        .icon-link {
            text-decoration: none; /* Remove link underline */
            color: #333; /* Default color */
            transition: color 0.3s; /* Smooth color transition */
        }
        .icon-link:hover {
            color: #120a8f; /* Change color on hover */
            text-decoration: none;
        }
        .icon-link i {
            font-size: 20px; /* Adjust icon size */
        }
    `;
    document.head.appendChild(style);
// Navigation content
const navContent = `
<div class="logo"><a href="index.html"><b style="color: #ffffff">Music</b> <b style="color: #000000">Grid</b></a></div>
 <ul>
            <li><a href="https://github.com/MiguelCarino/MusicGrid" target="_blank" class="icon-link">
                <i class="fab fa-github"></i> <span class="label"></span>
            </a></li>
            <li><a href="https://www.linkedin.com/in/miguelcarino94" target="_blank" class="icon-link">
                <i class="fab fa-linkedin"></i> <span class="label"></span>
            </a></li>
        </ul>
`;
document.getElementById('navbar').innerHTML = navContent;

// Footer content
const footerContent = `
 <p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/MiguelCarino/MusicGrid">Music Grid</a> by <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://github.com/MiguelCarino">Miguel Carino</a> is marked with <a href="https://creativecommons.org/publicdomain/zero/1.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC0 1.0 Universal<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/zero.svg?ref=chooser-v1" alt=""></a></p> 
`;
document.getElementById('footer').innerHTML = footerContent;
console.log('grid.js loaded');
