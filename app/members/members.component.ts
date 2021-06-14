import { Component, ViewChild, Injectable} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { MatPaginator, MatTableDataSource } from '@angular/material';
import { FormBuilder, FormControl } from '@angular/forms';

import { merge, Subject, Observable } from 'rxjs';
import { startWith, switchMap, tap, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { MatDialog } from '@angular/material';

import { MemberModel } from './member.model';
import { HttpService } from '../http.service';

import { ConfirmService } from '../services/confirm-dialog/confirm.service';
import { MessagesService } from '../services/messages-service/messages.service';

import { AddMemberComponent } from './add-member/add-member.component';
import { EditMemberComponent } from './edit-member/edit-member.component';
import { countries } from '../../server/countries-list';

@Component({
  selector: 'app-members',
  templateUrl: './members.component.html',
})


export class MembersComponent {

private idColumn = 'id';
private dbTable = 'members';
private membersUrl = 'api/members';

private dsData: any;

// dataSource: MatTableDataSource<MemberModel>;
@ViewChild(MatPaginator) paginator: MatPaginator;

  public dataLength: number;

  private addMemberComponent = AddMemberComponent;
  private editMemberComponent = EditMemberComponent;

  private idArray: number[] = [];  // Create array for checkbox selection in table.
  private memberArray = [];

 public displayedColumns = [
      'select',
      'firstName',
      'lastName',
      'userName',
      'country',
      'options'
  ];

  public dataSource = new MatTableDataSource;

 // For the countries search dropdown.
  public countries = countries;
  public country: string;
  public countriesControl = new FormControl('');

  // For last name query
  public searchTerm$ = new Subject<string>();

  constructor(
    private httpService:  HttpService,
    public dialog: MatDialog,
    private confirmService: ConfirmService,
    private messagesService: MessagesService,
    ) {


    // ------  LAST NAME SERCH -------------
  
    this.httpService.nameSearch(this.searchTerm$)
    .subscribe(data => {
        this.dataLength = data.length;
        this.dataSource.data = data;
      });
    }


  ngAfterViewInit() {
      this.dataSource.paginator = this.paginator;
    }

/*  The Angular Material Data Table docs recommended http with paginator setup below reloads the earlier query when the user alternates between multiple queries in one view.  More queries on the page makes this worse fast.  My suggested code here works.

*/
/*
  private getAllRecords(): any {
    // Kills the paginator if omitted.
    this.dataSource.paginator = this.paginator;  

    merge(this.paginator.page).pipe(
      // Tap called only with page forward.
      tap(val => console.log('page forward in getAllRecords')),
      startWith(null),  // Delete this and no data is downloaded.
      switchMap(() => {
        console.log('paginator.pageIndex: ', this.paginator.pageIndex);
        console.log('paginator.length: ', paginator.length);  // Should show all records for the second page, index 1.
        return this.httpService.getAllRecords(this.membersUrl);
      }),
    )

    .subscribe(data => {
      this.dataLength = data.length;
      this.dataSource.data = data;
    },
    (err: HttpErrorResponse) => {
    console.log(err.error);
    console.log(err.message);
    });
  }
*/

  // -------------- CRUD ----------------------


  // ----------------- GET ALL ------------------

  //  This works fine when multiple queries used.
  public getAllRecords(): any {
      this.httpService.getAllRecords(this.membersUrl)
      .subscribe(data => {
        this.dataLength = data.length;
        this.dataSource.data = data;
      });
    }
 
  // ------------------ ADD --------------------


  public addRecord() {
    this.dialog.open(this.addMemberComponent);
  }


  // ----------- EDIT & UPDATE --------------

  public editRecord(recordId) {
    this.dialog.open(this.editMemberComponent, {
      data: {recordId: recordId, idColumn: this.idColumn, paginator: this.paginator, dataSource: this.dataSource}
    });
  }



// --------------- DELETE ------------------

  public deleteRecord(recordId) {
    const dsData = this.dataSource.data;

    // For delete confirm dialog in deleteItem to match the db column name to fetch.
    const name1 = 'first_name';
    const name2 = 'last_name';
    const record = dsData.find(obj => obj[this.idColumn] === recordId);
    const name = 'Delete ' + record[name1] + ' ' + record[name2] + '?';

    const url = `${this.membersUrl}/${recordId}`;

    // Call the confirm dialog component
    this.confirmService.confirm(name, 'This action is final. Gone forever!').pipe(
      switchMap(res => {if (res === true) {
        console.log('url: ', url);
        return this.httpService.deleteRecord(url);
      }}))
      .subscribe(
        result => {
          this.success();
          // Refresh DataTable to remove row.
          this.deleteRowDataTable (recordId, this.idColumn, this.paginator, this.dataSource);
        },
        (err: HttpErrorResponse) => {
          console.log(err.error);
          console.log(err.message);
          this.messagesService.openDialog('Error', 'Delete did not happen.');
        }
      );
  }

// Remove the deleted row from the data table. Need to remove from the downloaded data first.
  private deleteRowDataTable (recordId, idColumn, paginator, dataSource) {
    this.dsData = dataSource.data;
    const itemIndex = this.dsData.findIndex(obj => obj[idColumn] === recordId);
    dataSource.data.splice(itemIndex, 1);
    dataSource.paginator = paginator;
  }



  // ----------- SEARCH BY COUNTRY ------------------

  public searchCountries(country): any {

    const url = `${this.membersUrl}/?country=${country}`;

    this.httpService.searchCountries(url)
      .subscribe(data => {
        this.dataLength = data.length;
        this.dataSource.data = data;
      });
  }


  //  ---- LAST NAME INCREMENTAL QUERY IN CONSTRUCTOR -------



  // -------------- SELECT BOX ------------------


  // Called each time a checkbox is checked in the mat table.
  public selectMember(selectedMember) {
    // push the id's into an array then call it with the button.
    return this.idArray.push(selectedMember);
  }
  //   |
  //   |
  //   |
  //   V

  // Called by the Show Selected button.
  public getAllSelected() {
    this.memberArray = [];
    const tempArray = [];
    const ds = this.dataSource.data;
    const property = 'id';

    this.idArray.forEach(function (id, i) {

      // Need to match ids in idArray with dataSource.data.
       const memberId: number = id;  // Extracts member id from selection array.

      // Search dataSource for each member_id and push those selected into a new data object.
      ds.forEach(function (member, index) {

        if (ds[index][property] === memberId) {
          tempArray.push(member);
        }
      });
    });

    this.idArray = []; // Empty the array for next query.
    this.memberArray = tempArray;
    this.paginator.pageIndex = 0;
    this.dataSource.data = this.memberArray;
  }

// -----------  UTILITIES ------------------


  private success() {
    this.messagesService.openDialog('Success', 'Database updated as you wished!');
  }

  private handleError(error) {
    this.messagesService.openDialog('Error', 'No database connection.');
  }




}
