import { describe, expect, it } from "vitest";
import { buildBetSettlementRows, selectionWon } from "./bet-settlement";
import type { TrackerRecord } from "./tracker-store";

function row(kind: TrackerRecord["kind"], id: string, details: TrackerRecord["details"], status="OPEN"): TrackerRecord {
  return { id, kind, title:id, status, details, createdAt:"2026-01-01T00:00:00.000Z" };
}

describe("bet settlement",()=>{
  it("grades 1X2 and Double Chance selections",()=>{
    expect(selectionWon("1","1")).toBe(true);
    expect(selectionWon("X","2")).toBe(false);
    expect(selectionWon("1X","X")).toBe(true);
    expect(selectionWon("X2","2")).toBe(true);
    expect(selectionWon("12","X")).toBe(false);
  });
  it("calculates selected stake profit/loss and hypothetical rejected outcomes",()=>{
    const records=[
      row("bet","selected",{fixtureId:"f1",decision:"SELECTED",selection:"1X",stake:5,odds:1.8}),
      row("bet","rejected",{fixtureId:"f2",decision:"REJECTED",selection:"2",stake:0,odds:2.4}),
      row("result","r1",{fixtureId:"f1",actual:"1"}),
      row("result","r2",{fixtureId:"f2",actual:"2"}),
    ];
    const settlements=buildBetSettlementRows(records);
    expect(settlements.map(x=>x.status)).toEqual(["WON","ODRZUCONY_TRAFIŁ"]);
    expect(settlements[0].details.profitLoss).toBe(4);
    expect(settlements[1].details.profitLoss).toBe(0);
  });
  it("does not settle selected bets with invalid odds or stakes",()=>{
    const records=[
      row("bet","bad-odds",{fixtureId:"f1",decision:"SELECTED",selection:"1",stake:5,odds:1}),
      row("bet","bad-stake",{fixtureId:"f2",decision:"SELECTED",selection:"1",stake:-5,odds:2}),
      row("result","r1",{fixtureId:"f1",actual:"1"}),
      row("result","r2",{fixtureId:"f2",actual:"1"}),
    ];
    expect(buildBetSettlementRows(records)).toHaveLength(0);
  });
  it("uses the newest valid fixture result regardless of Tracker array order",()=>{
    const records=[
      row("result","old",{fixtureId:"f",actual:"1"}),
      { ...row("result","new",{fixtureId:"f",actual:"2"}), createdAt:"2026-01-02T00:00:00.000Z" },
      row("bet","b",{fixtureId:"f",decision:"SELECTED",selection:"2",stake:5,odds:2}),
    ];
    expect(buildBetSettlementRows(records)[0].status).toBe("WON");
  });
  it("does not create duplicate settlements or settle unknown results",()=>{
    const records=[
      row("bet","b",{fixtureId:"f",decision:"SELECTED",selection:"1",stake:5,odds:2}),
      row("bet","s",{parentBetId:"b",profitLoss:5},"WON"),
    ];
    expect(buildBetSettlementRows(records)).toHaveLength(0);
  });
});
