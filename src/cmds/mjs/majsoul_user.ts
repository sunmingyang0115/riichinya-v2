export class MajsoulUser {
  amaeId: string;
  mjsNickname: string;
  constructor(mjsNickname: string, amaeId: string) {
    this.mjsNickname = mjsNickname;
    this.amaeId = amaeId;
  }
  
  /*
  General procedure to fetch a player's stats:
  - if we want to use time/limit to filter, use /player_records/<player_id>/start/end?limit=&mode=&descending=true
    - this gets us all the games played by limit, and we can get their timestamps
  - make request to /player_stats/<player_id>/<start_timestamp>/<end_timestamp>?mode=16.12.9.15.11.8 (all modes)
    - start and end are determined above via /player_records
    - this gets all the played modes. maybe this stat is worth caching in our database?
  - make request to /player_extended_stats/<player_id>/<start_timestamp>/<end_timestamp>?mode=<mode>
    - this should be the very last request made.
  */

  /*
  */
  async fetchStats() {

  }

}

export const 