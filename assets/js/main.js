// Navigation content
const navContent = `
<div class="logo"><a href="index.html"><b style="color: #ffffff">Music</b> <b style="color: #000000">Grid</b></a></div>
<ul>
    <li><a href="https://github.com/MiguelCarino" class=""><span class="label">Github</span></a></li>
</ul>
`;
document.getElementById('navbar').innerHTML = navContent;

// Footer content
const footerContent = `
 <p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/MiguelCarino/MusicGrid">Music Grid</a> by <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://github.com/MiguelCarino">Miguel Carino</a> is marked with <a href="https://creativecommons.org/publicdomain/zero/1.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC0 1.0 Universal<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/zero.svg?ref=chooser-v1" alt=""></a></p> 
`;
document.getElementById('footer').innerHTML = footerContent;
console.log('grid.js loaded');
