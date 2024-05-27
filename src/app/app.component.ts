import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

type PointOfInterest = {
  index: number;
  name?: string;
  position: google.maps.LatLngLiteral;
  marker: google.maps.marker.AdvancedMarkerElement;
};

type Track = {
  index: number;
  name?: string;
  masterPolyline: google.maps.Polyline;
  elevationPolylines: Array<google.maps.Polyline>;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {

  @ViewChild('mapElement', {static: true}) private mapElement!: ElementRef<HTMLElement>;

  public pointsOfInterest: Array<PointOfInterest> = [];
  public gpxTracks: Array<Track> = [];
  private map!: google.maps.Map;

  constructor(private readonly cd: ChangeDetectorRef) {}

  public ngOnInit(): void {
    this.map = new google.maps.Map(this.mapElement.nativeElement, {
      mapId: 'DEMO_MAP_ID',
      center: { lat: 46.4675751, lng: 5.8919042 },
      zoom: 11,
      clickableIcons: false,
      gestureHandling: 'greedy',
      styles: [
        {
          featureType: 'poi.business',
          elementType: 'labels',
          stylers: [
            { visibility: 'off' },
          ],
        },
        {
          featureType: 'poi.government',
          elementType: 'labels',
          stylers: [
            { visibility: 'off' },
          ],
        },
        {
          featureType: 'poi.medical',
          elementType: 'labels',
          stylers: [
            { visibility: 'off' },
          ],
        },
        {
          featureType: 'poi.school',
          elementType: 'labels',
          stylers: [
            { visibility: 'off' },
          ],
        },
        {
          featureType: 'transit.station',
          elementType: 'labels',
          stylers: [
            { visibility: 'off' },
          ],
        },
      ],
    });
    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        this.addPointOfInterest(event.latLng);
      }
    });
  }

  public addPointOfInterest(latLng: google.maps.LatLng, name?: string): void {
    const poi: PointOfInterest = {
      index: this.pointsOfInterest.length,
      name: name,
      position: { lat: latLng.lat(), lng: latLng.lng() },
      marker: new google.maps.marker.AdvancedMarkerElement({
        zIndex: 1000000 - Math.trunc(latLng.lat() * 10000),
        content: new  google.maps.marker.PinElement({ glyph: (this.pointsOfInterest.length + 1).toString() }).element,
        position: latLng,
        map: this.map,
        gmpDraggable: true,
      }),
    };
    poi.marker.addListener('click', () => {
      this.removePointOfInterest(poi);
    });
    poi.marker.addListener('drag', () => {
      const lat = (poi.marker.position as google.maps.LatLngLiteral).lat;
      const lng = (poi.marker.position as google.maps.LatLngLiteral).lng;
      poi.position.lat = lat;
      poi.position.lng = lng;
      this.cd.detectChanges();
    });
    this.pointsOfInterest.push(poi);
    this.cd.detectChanges();
  }

  public removePointOfInterest(poiToRemove: PointOfInterest): void {
    this.pointsOfInterest.splice(poiToRemove.index, 1);
    poiToRemove.marker.map = null;
    this.pointsOfInterest.forEach((poi, index) => {
      if (index >= poiToRemove.index) {
        poi.index = index;
        poi.marker.content = new  google.maps.marker.PinElement({ glyph: (index + 1).toString() }).element;
      }
    });
    this.cd.detectChanges();
  }

  public removeGpxTrack(trackToRemove: Track): void {
    this.gpxTracks.splice(trackToRemove.index, 1);
    trackToRemove.masterPolyline.setMap(null);
    trackToRemove.elevationPolylines.forEach((polyline) => polyline.setMap(null));
    this.gpxTracks.forEach((track, index) => {
      if (index >= trackToRemove.index) {
        track.index = index;
      }
    });
    this.cd.detectChanges();
  }

  public exportPointsOfInterest(): void {
    const pointsOfInterest = this.pointsOfInterest.map((poi) => ({
      name: poi.name,
      latitude: poi.position.lat,
      longitude: poi.position.lng,
    }));
    const pointsOfInterestBlob = new Blob(
      [JSON.stringify(pointsOfInterest, null, 2)],
      {type: 'text/plain'},
    );
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', URL.createObjectURL(pointsOfInterestBlob));
    downloadLink.setAttribute('download', 'points-of-interest.json');
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  public importsGpxFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      console.error('No file found');
      return;
    }
    const reader = new FileReader();
    reader.onload = (progressEvent): void => {
      const result = progressEvent.target?.result?.toString();
      if (!result) {
        console.error('Reader has no result');
        return;
      }
      const gpxDocument = new DOMParser().parseFromString(result, 'text/xml');
      const parserErrorElement = gpxDocument.querySelector('parsererror');
      if (parserErrorElement) {
        console.error(`XML Parser Error :\n${parserErrorElement.textContent}`);
        return;
      }

      const trackPoints = gpxDocument.getElementsByTagName('trkpt');
      const gradient = [
        {
          red: 0,
          green: 198,
          blue: 255,
          step: 0,
        },
        {
          red: 147,
          green: 85,
          blue: 255,
          step: 33,
        },
        {
          red: 255,
          green: 0,
          blue: 0,
          step: 66,
        },
        {
          red: 0,
          green: 0,
          blue: 0,
          step: 100,
        },
      ];
      let minElevation = Number.POSITIVE_INFINITY;
      let maxElevation = Number.NEGATIVE_INFINITY;
      const masterPolyline = new google.maps.Polyline({
        zIndex: 0,
        geodesic: true,
        clickable: false,
        strokeColor: '#fff',
        strokeOpacity: 1.0,
        strokeWeight: 7,
      });
      const trailPoints = [];
      for (const trackPoint of trackPoints) {
        const latitude = parseFloat(trackPoint.getAttribute('lat') ?? '0');
        const longitude = parseFloat(trackPoint.getAttribute('lon') ?? '0');
        const elevation = parseFloat(trackPoint.querySelector('ele')?.textContent ?? '0');
        const point = new google.maps.LatLng(latitude, longitude);
        if (elevation < minElevation) {
          minElevation = elevation;
        }
        else if (elevation > maxElevation) {
          maxElevation = elevation;
        }
        trailPoints.push({
          elevation: elevation,
          point: point,
        });
        masterPolyline.getPath().push(point);
        masterPolyline.setMap(this.map);
      }

      const elevationPolylines = [];
      for (let i = 1; i < trailPoints.length; i++) {
        const averageElevation = (trailPoints[i - 1].elevation + trailPoints[i].elevation) / 2;
        const step = (averageElevation - minElevation) * (100 / (maxElevation - minElevation));
        let minColor = gradient[0];
        let maxColor = gradient[gradient.length - 1];
        for (const gradientColor of gradient) {
          if (gradientColor.step <= step && gradientColor.step > minColor.step) {
            minColor = gradientColor;
          }
          if (gradientColor.step >= step && gradientColor.step < maxColor.step) {
            maxColor = gradientColor;
          }
        }
        let color = {
          red: maxColor.red,
          green: maxColor.green,
          blue: maxColor.blue,
        };
        if (minColor !== maxColor) {
          const multiplier = (step - minColor.step) * 100 / (maxColor.step - minColor.step);
          color = {
            red: Math.round(minColor.red + (maxColor.red - minColor.red) * multiplier / 100),
            green: Math.round(minColor.green + (maxColor.green - minColor.green) * multiplier / 100),
            blue: Math.round(minColor.blue + (maxColor.blue - minColor.blue) * multiplier / 100),
          };
        }
        elevationPolylines.push(new google.maps.Polyline({
          zIndex: 1,
          map: this.map,
          path: [trailPoints[i - 1].point, trailPoints[i].point],
          geodesic: true,
          clickable: false,
          strokeColor: `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`,
          strokeOpacity: 1.0,
          strokeWeight: 3,
        }));
      }

      this.gpxTracks.push({
        index: this.gpxTracks.length,
        masterPolyline: masterPolyline,
        elevationPolylines: elevationPolylines,
      });
      this.cd.detectChanges();
    };
    reader.readAsText(file, 'UTF-8');
  }

  public importPointsOfInterst(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      console.error('No file found');
      return;
    }
    const reader = new FileReader();
    reader.onload = (progressEvent): void => {
      try {
        const result = progressEvent.target?.result?.toString();
        if (!result) {
          console.error('Reader has no result');
          return;
        }
        const pointsOfInterest = JSON.parse(result);
        if (Array.isArray(pointsOfInterest)) {
          pointsOfInterest.forEach((poi) => {
            if (poi.latitude && poi.longitude) {
              this.addPointOfInterest(new google.maps.LatLng(poi.latitude, poi.longitude), poi.name);
            }
          });
        }
      }
      catch (error) {
        console.error(error);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  public copyPointOfInterestToClipboard(poi: PointOfInterest, round?: number, asXml?: boolean): void {
    let lat = poi.position.lat;
    let lng = poi.position.lng;
    if (round !== undefined && round >= 0) {
      const multiplier = Math.pow(10, round);
      lat = Math.round(lat * multiplier) / multiplier;
      lng = Math.round(lng * multiplier) / multiplier;
    }

    if (asXml) {
      navigator.clipboard.writeText(`lat="${lat}" lng="${lng}"`);
    }
    else {
      navigator.clipboard.writeText(`${lat}, ${lng}`);
    }
  }

}
