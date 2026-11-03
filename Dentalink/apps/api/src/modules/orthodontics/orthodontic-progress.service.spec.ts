import { Test, TestingModule } from '@nestjs/testing';
import { OrthodonticProgressService } from './orthodontic-progress.service';
import { PrismaService } from '../../database/prisma.service';

describe('OrthodonticProgressService', () => {
  let service: OrthodonticProgressService;

  const mockPrisma = {
    treatmentPlan: {
      findUnique: jest.fn()
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrthodonticProgressService,
        { provide: PrismaService, useValue: mockPrisma }
      ],
    }).compile();

    service = module.get<OrthodonticProgressService>(OrthodonticProgressService);
  });

  describe('Business Rules for Calendar and Control Progress', () => {
    
    // helper to mock the db return and run summary
    const runSummary = async (startDate: Date | null, estimatedMonths: number, pauses: any[], orthodonticControls: any[], cutoffDate: Date) => {
      mockPrisma.treatmentPlan.findUnique.mockResolvedValue({
        id: '123',
        patientId: 'pat1',
        branchId: 'b1',
        status: 'ACTIVE',
        orthodonticProfile: {
          id: 'opt1',
          startDate,
          estimatedMonths,
          estimatedControls: estimatedMonths
        },
        orthodonticControls,
        clinicalEvolutions: [],
        appointments: [],
        pauses
      });
      return service.getProgressSummary('123', cutoffDate);
    };

    it('1. 0 de 24 meses = 0%', async () => {
      const start = new Date('2026-01-01');
      const cutoff = new Date('2026-01-01'); // exactly same day, 0 elapsed
      const res = await runSummary(start, 24, [], [], cutoff);
      expect(res.calendarProgress.percentage).toBe(0);
    });

    it('2. 6 de 24 meses = 25%', async () => {
      const start = new Date('2026-01-01');
      // roughly 6 months later
      const cutoff = new Date(start.getTime() + (1000 * 60 * 60 * 24 * 30.4368 * 6));
      const res = await runSummary(start, 24, [], [], cutoff);
      expect(Math.round(res.calendarProgress.percentage as number)).toBe(25);
    });

    it('3. 30 de 24 meses = 125%', async () => {
      const start = new Date('2026-01-01');
      // roughly 30 months later
      const cutoff = new Date(start.getTime() + (1000 * 60 * 60 * 24 * 30.4368 * 30));
      const res = await runSummary(start, 24, [], [], cutoff);
      expect(Math.round(res.calendarProgress.percentage as number)).toBe(125);
      expect(res.calendarProgress.isExceeded).toBe(true);
    });

    it('4. Tratamiento pausado congela calendario', async () => {
      const start = new Date('2026-01-01');
      const cutoff = new Date(start.getTime() + (1000 * 60 * 60 * 24 * 30.4368 * 6)); // 6 months total
      const pauses = [{
        startDate: new Date(start.getTime() + (1000 * 60 * 60 * 24 * 30.4368 * 2)), // pause at month 2
        endDate: new Date(start.getTime() + (1000 * 60 * 60 * 24 * 30.4368 * 4)) // resume at month 4
      }]; // paused for 2 months
      
      const res = await runSummary(start, 24, pauses, [], cutoff);
      // active elapsed is 4 months instead of 6
      // 4 / 24 = 16.666%
      expect(Math.round(res.calendarProgress.percentage as number)).toBe(17);
    });

    it('5. 4 de 24 controles = 16.67%, visualmente 17%', async () => {
      const start = new Date('2026-01-01');
      const controls = Array(4).fill({ status: 'COMPLETED' });
      const res = await runSummary(start, 24, [], controls, start);
      
      expect(res.controlProgress.percentage).toBeCloseTo(16.666, 2);
      expect(res.controlProgress.displayPercentage).toBe(17);
    });

    it('7. 0 calendario y 17 real = +17 puntos', async () => {
      const start = new Date('2026-01-01');
      const controls = Array(4).fill({ status: 'COMPLETED' });
      const res = await runSummary(start, 24, [], controls, start); // 0 elapsed, 4 controls = 17%
      
      expect(res.progressDifference.percentagePoints).toBeCloseTo(16.666, 2);
      expect(res.progressDifference.displayValue).toBe(17);
      expect(res.progressDifference.status).toBe('AHEAD');
    });

    it('8. 50 calendario y 25 real = -25 puntos', async () => {
      const start = new Date('2026-01-01');
      const cutoff = new Date(start.getTime() + (1000 * 60 * 60 * 24 * 30.4368 * 12)); // 12 months = 50% cal
      const controls = Array(6).fill({ status: 'COMPLETED' }); // 6 controls = 25%
      const res = await runSummary(start, 24, [], controls, cutoff); 
      
      expect(Math.round(res.progressDifference.percentagePoints as number)).toBe(-25);
      expect(res.progressDifference.status).toBe('DELAYED');
    });

    it('9. Valores iguales = 0 puntos', async () => {
      const start = new Date('2026-01-01');
      const cutoff = new Date(start.getTime() + (1000 * 60 * 60 * 24 * 30.4368 * 12)); // 12 months = 50% cal
      const controls = Array(12).fill({ status: 'COMPLETED' }); // 12 controls = 50%
      const res = await runSummary(start, 24, [], controls, cutoff); 
      
      expect(Math.round(res.progressDifference.percentagePoints as number)).toBe(0);
      expect(res.progressDifference.status).toBe('ON_TRACK');
    });

    it('10. Falta de datos = N/D', async () => {
      const start = new Date('2026-01-01');
      const cutoff = new Date('2026-01-01');
      const res = await runSummary(null, 0, [], [], cutoff); // no start date, no estimated months
      
      expect(res.calendarProgress.isCalculable).toBe(false);
      expect(res.controlProgress.isCalculable).toBe(false);
      expect(res.progressDifference.status).toBe('NOT_CALCULABLE');
    });

  });
});
