import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransfersComponent } from './transfers.Component';

describe('Transfers', () => {
  let component: TransfersComponent;
  let fixture: ComponentFixture<TransfersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransfersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransfersComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
