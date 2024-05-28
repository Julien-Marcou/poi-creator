import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

type PointOfInterest = {
  index: number;
  name?: string;
  position: google.maps.LatLngLiteral;
  marker: google.maps.marker.AdvancedMarkerElement;
};

type TrailPoint = {
  elevation: number;
  position: google.maps.LatLng;
  time: Date;
};

type Track = {
  index: number;
  filename?: string;
  name: string;
  time: string;
  points: Array<TrailPoint>;
  masterPolyline: google.maps.Polyline;
  elevationPolylines: Array<google.maps.Polyline>;
  isEditing: boolean;
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

  public toggleGpxEdition(track: Track): void {
    track.isEditing = !track.isEditing;
    if (track.isEditing) {
      track.masterPolyline.setEditable(true);
      track.masterPolyline.setOptions({ strokeColor: '#000' });
    }
    else {
      track.masterPolyline.setEditable(false);
      track.masterPolyline.setOptions({ strokeColor: '#fff' });
    }
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

  public downloadGpxTrack(track: Track): void {
    /* eslint-disable max-len */
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <time>${track.time}</time>
  </metadata>
  <trk>
    <name>${track.name}</name>
    <trkseg>${track.points.map((point) => `
      <trkpt lat="${this.round(point.position.lat(), 6)}" lon="${this.round(point.position.lng(), 6)}">
        <ele>${point.elevation}</ele>
        <time>${point.time.toISOString()}</time>
      </trkpt>`).join('')}
    </trkseg>
  </trk>
</gpx>
`;
    /* eslint-enable max-len */
    const pointsOfInterestBlob = new Blob(
      [gpxContent],
      {type: 'text/plain'},
    );
    this.downloadBlob(pointsOfInterestBlob, track.filename ?? 'gpx_track.gpx');
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
    this.downloadBlob(pointsOfInterestBlob, 'points_of_interest.json');
  }

  public importGpxFile(event: Event): void {
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

      const metadataTime = gpxDocument.querySelector('metadata > time')?.textContent ?? 'PUT_YOUR_TIME_HERE';
      const trackName = gpxDocument.querySelector('trk > name')?.textContent ?? 'PUT_YOUR_NAME_HERE';
      const trackPoints = gpxDocument.getElementsByTagName('trkpt');
      const trailPoints: Array<TrailPoint> = [];
      for (const trackPoint of trackPoints) {
        const latitude = parseFloat(trackPoint.getAttribute('lat') ?? '0');
        const longitude = parseFloat(trackPoint.getAttribute('lon') ?? '0');
        const elevation = parseFloat(trackPoint.querySelector('ele')?.textContent ?? '0');
        const time = new Date(trackPoint.querySelector('time')?.textContent ?? '');
        trailPoints.push({
          elevation: elevation,
          position: new google.maps.LatLng(latitude, longitude),
          time: time,
        });
      }

      const masterPolyline = this.getMasterPolyline(trailPoints);
      const track: Track = {
        index: this.gpxTracks.length,
        filename: file.name,
        name: trackName,
        time: metadataTime,
        points: trailPoints,
        masterPolyline: masterPolyline,
        elevationPolylines: this.getElevationPolylines(trailPoints),
        isEditing: false,
      };

      const updatePolylines = (): void => {
        track.elevationPolylines.forEach((polyline) => polyline.setMap(null));
        track.elevationPolylines = this.getElevationPolylines(trailPoints);
        this.cd.detectChanges();
      };

      masterPolyline.getPath().addListener('insert_at', (index: number) => {
        const newPosition = masterPolyline.getPath().getAt(index);
        const averageElevation = (trailPoints[index - 1].elevation + trailPoints[index].elevation) / 2;
        const averageTime = new Date((trailPoints[index - 1].time.getTime() + trailPoints[index].time.getTime()) / 2);
        trailPoints.splice(index, 0, { elevation: averageElevation, position: newPosition, time: averageTime});
        updatePolylines();
      });
      masterPolyline.getPath().addListener('set_at', () => {
        const positions = masterPolyline.getPath().getArray();
        positions.forEach((position, index) => {
          trailPoints[index].position = position;
        });
        updatePolylines();
      });

      this.gpxTracks.push(track);
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

  public copyPointOfInterestToClipboard(poi: PointOfInterest, asXml?: boolean): void {
    const lat = poi.position.lat;
    const lng = poi.position.lng;

    if (asXml) {
      navigator.clipboard.writeText(`lat="${this.round(lat)}" lng="${this.round(lng)}"`);
    }
    else {
      navigator.clipboard.writeText(`${lat}, ${lng}`);
    }
  }

  private getMasterPolyline(trailPoints: Array<TrailPoint>): google.maps.Polyline {
    const masterPolyline = new google.maps.Polyline({
      zIndex: 0,
      geodesic: true,
      clickable: false,
      strokeColor: '#fff',
      strokeOpacity: 1.0,
      strokeWeight: 7,
    });

    for (const trailPoint of trailPoints) {
      masterPolyline.getPath().push(trailPoint.position);
      masterPolyline.setMap(this.map);
    }

    return masterPolyline;
  }

  private getElevationPolylines(trailPoints: Array<TrailPoint>): Array<google.maps.Polyline> {
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
    for (const trailPoint of trailPoints) {
      if (trailPoint.elevation < minElevation) {
        minElevation = trailPoint.elevation;
      }
      else if (trailPoint.elevation > maxElevation) {
        maxElevation = trailPoint.elevation;
      }
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
        path: [trailPoints[i - 1].position, trailPoints[i].position],
        geodesic: true,
        clickable: false,
        strokeColor: `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`,
        strokeOpacity: 1.0,
        strokeWeight: 3,
      }));
    }

    return elevationPolylines;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', URL.createObjectURL(blob));
    downloadLink.setAttribute('download', filename);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  private round(value: number, decimals = 6): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

}
