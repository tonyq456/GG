const clampLatitude=lat=>Math.max(-85,Math.min(85,lat));
export function projectMercator(lat,lon,zoom){const n=256*2**zoom,s=Math.sin(clampLatitude(lat)*Math.PI/180);return{x:(lon+180)/360*n,y:(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n}}
export function unprojectMercator(x,y,zoom){const n=256*2**zoom;return{lon:((x/n*360)%360+360)%360-180,lat:clampLatitude(Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI)}}
