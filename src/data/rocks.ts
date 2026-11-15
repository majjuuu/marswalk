export const mineralSource='https://science.nasa.gov/photojournal/perseverances-pixl-finds-vivianite-greigite-in-cheyava-falls-sample/';
export const leopardPhotoSource='https://science.nasa.gov/photojournal/perseverance-finds-a-rock-with-leopard-spots/';
export const leopardPhoto='/rocks/cheyava-falls.jpg';
export const mineralSummary='Vivianite (hydrated iron phosphate) occurs in the dark rims and tiny “poppy seed” spots; greigite (iron sulfide) occurs within the larger leopard-spot interiors. Together, they trace reaction fronts where electron-transfer chemistry altered the reddish sediment, leaving pale cores bordered by dark mineral-rich rims. These reactions may involve organic matter and water, but can occur without life; their biological origin remains unconfirmed.';
/** Photograph projected onto an educational mesh, not a surveyed 3D reconstruction. */
export const rockSamples = [
 {id:'leopard',name:'Cheyava Falls · leopard spots',position:[0,-53] as [number,number],summary:mineralSummary,formula:'Vivianite · Fe₃(PO₄)₂·8H₂O + Greigite · Fe₃S₄',source:leopardPhotoSource},
];
export const rockById=Object.fromEntries(rockSamples.map(rock=>[rock.id,rock]));
