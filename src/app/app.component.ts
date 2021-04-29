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
    this.pointsOfInterest.forEach((poi, index) => {
      poi.index = index;
      poi.marker.setLabel((index + 1).toString());
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

  importPointsOfInterst(event: Event): void {
    const file = (event.target as HTMLInputElement).files![0];
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const pointsOfInterest = JSON.parse(event.target!.result!.toString());
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
