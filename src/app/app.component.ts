import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

type PointOfInterest = {
  index: number,
  name?: string,
  marker: google.maps.Marker,
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {

  @ViewChild('mapElement') mapElement?: ElementRef;

  private map?: google.maps.Map;
  public pointsOfInterest: Array<PointOfInterest> = [];

  ngAfterViewInit() {
    this.map = new google.maps.Map(this.mapElement!.nativeElement, {
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
    this.map.addListener('click', (event) => {
      this.addPointOfInterest(event.latLng);
    });
  }

  addPointOfInterest(latLng: google.maps.LatLng, name?: string): void {
    const poi: PointOfInterest = {
      index: this.pointsOfInterest.length,
      name: name,
      marker: new google.maps.Marker({
        zIndex: 1000000 - Math.trunc(latLng.lat() * 10000),
        label: (this.pointsOfInterest.length + 1).toString(),
        position: latLng,
        map: this.map,
        draggable: true,
      }),
    };
    poi.marker.addListener('click', () => {
      this.removePointOfInterest(poi);
    });
    this.pointsOfInterest.push(poi);
  }

  removePointOfInterest(poi: PointOfInterest): void {
    this.pointsOfInterest.splice(poi.index, 1);
    poi.marker.setMap(null);
    this.pointsOfInterest.forEach((_poi, index) => {
      if (index >= poi.index) {
        _poi.index = index;
        _poi.marker.setLabel((index + 1).toString());
      }
    });
  }

  exportPointsOfInterest(): void {
    const pointsOfInterest = this.pointsOfInterest.map(poi => {
      return {
        name: poi.name,
        latitude: poi.marker.getPosition()!.lat(),
        longitude: poi.marker.getPosition()!.lng(),
      }
    });
    const pointsOfInterestBlob = new Blob(
      [JSON.stringify(pointsOfInterest, null, 2)],
      {type: 'text/plain'}
    );
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', URL.createObjectURL(pointsOfInterestBlob));
    downloadLink.setAttribute('download', 'points-of-interest.json');
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  importsGpxFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files![0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (_event: ProgressEvent<FileReader>) => {
      const gpxDocument = new DOMParser().parseFromString(_event.target!.result!.toString(), 'text/xml');
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
      })
      const trailPoints = [];
      for (let i = 0; i < trackPoints.length; i++) {
        const trackPoint = trackPoints[i];
        const latitude = parseFloat(trackPoint.getAttribute('lat')!);
        const longitude = parseFloat(trackPoint.getAttribute('lon')!);
        const elevation = parseFloat(trackPoint.querySelector('ele')!.textContent!);
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
        masterPolyline.setMap(this.map!);
      }

      const elevationPolylines = [];
      for (let i = 1; i < trailPoints.length; i++) {
        const elevation = trailPoints[i].elevation - trailPoints[i - 1].elevation;
        const step = (((trailPoints[i - 1].elevation + trailPoints[i].elevation) / 2) - minElevation) * (100 / (maxElevation - minElevation));
        let minColor = gradient[0];
        let maxColor = gradient[gradient.length - 1];
        for (const color of gradient) {
          if (color.step <= step && color.step > minColor.step) {
            minColor = color;
          }
          if (color.step >= step && color.step < maxColor.step) {
            maxColor = color;
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
    };
    reader.readAsText(file, 'UTF-8');
  }

  importPointsOfInterst(event: Event): void {
    const file = (event.target as HTMLInputElement).files![0];
    const reader = new FileReader();
    reader.onload = (_event: ProgressEvent<FileReader>) => {
      try {
        const pointsOfInterest = JSON.parse(_event.target!.result!.toString());
        if (Array.isArray(pointsOfInterest)) {
          pointsOfInterest.forEach(poi => {
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

  copyPointOfInterestToClipboard(poi: PointOfInterest): void {
    navigator.clipboard.writeText(`${poi.marker.getPosition()!.lat()}, ${poi.marker.getPosition()!.lng()}`);
  }

}
