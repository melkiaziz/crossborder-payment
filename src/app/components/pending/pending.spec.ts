import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PendingComponent } from './pending.Component';

describe('Pending', () => {
  let component: PendingComponent;
  let fixture: ComponentFixture<PendingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PendingComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
