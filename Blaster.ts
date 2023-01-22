import designs from "src/resources/designs"

import * as utils from '@dcl/ecs-scene-utils'
import * as ui from '@dcl/ui-scene-utils'
import { Blaster_UI } from "./blaster_UI"
import { ws } from "src/WebSockets/Instance"
import { observer_collected_spawn, observer_collected_spawns_on_init, observer_user_state } from "src/observers/observers"
import { map_counters } from "src/UI/UI"
import { ChestParser } from "./chest_parser"
import DialogPopup from "src/library_card_module/ui/DialogPopup"
import { hud } from "@dcl/builder-hud"
import LibraryCardGUI from "src/library_card_module/ui/LibraryCardGUI"
import { eventManager, libraryCardGui } from "src/library_card_module/library_card_index"
import { QuestCreditsUpdated } from "src/library_card_module/events/QuestCreditsUpdated"
// interface with title, book_model

export enum BlasterState{
    SEARCHING,
    DROPPED,
    SELECTED,
    ENDED
}
export interface IBook{
    title: string
    book_model: string,
    spawn_key: string
}

@Component('Blaster')
export class Blaster extends Entity implements ISystem
{

    public Books: IBook[] = []
    public CurrentState: BlasterState = BlasterState.SEARCHING

    public isVisible: boolean = false

    private offset:Vector3
    public _UI: Blaster_UI
    private _dropDown: Vector3
    private _chestParser: ChestParser
    private _equalsed_books: number = 0
    private _collider: Entity
    private _selected_scale = new Vector3(0.3, 0.3, 0.3)

    private _magazine: number = 0 

    private _popup: DialogPopup = new DialogPopup()
    constructor(
        offset: Vector3,
        parser: ChestParser
    ) {
        super()
        global_blaster = this

        this._UI = new Blaster_UI()
        
        this.offset = offset
        this._chestParser = parser
        this.CurrentState = BlasterState.SEARCHING
        this.addComponent(new Transform({position : new Vector3(21.5, 3.2, 45), rotation: Quaternion.Euler(0,60,0), scale: this._selected_scale}))
        this._dropDown = this.getComponent(Transform).position
        this.addComponent(designs.models.blaster)
        
        this.CreateCollider()
        this.Hide()
        engine.addEntity(this)
        engine.addSystem(this)

        
    }
    public Show(){

        global_blaster.CurrentState = BlasterState.SELECTED
        this._magazine = this.Books.length
        this._collider.getComponent(BoxShape).visible = false 
        this.getComponent(Transform).scale = new Vector3(0.3,0.3,0.3)

        this._UI.ShowCursor()
        this.OnBooksCountChanged()
        
    }

    public Hide(){

        this._collider.getComponent(BoxShape).visible = true
        
        this._UI.HideCursor() 
        
    }
    public removeAllBooks(){
        this.Books = []
        this.OnBooksCountChanged()
    }
    public AddBook(book: IBook){
        
        
        this.Books.push(book)
        this._magazine = this.Books.length
        this.OnBooksCountChanged()
    }
    public RemoveBook(){
        this.Books.pop()
        this.OnBooksCountChanged()
        this.CheckOnEnd()
    }

    update(dt: number): void{

        // if (this.CurrentState != BlasterState.SELECTED){
            
        //     if(this.isVisible)
        //         this.Hide()
            
        //     this.getComponent(Transform).rotation = Quaternion.Slerp(this.getComponent(Transform).rotation, this.getComponent(Transform).rotation.multiply(Quaternion.Euler(0,90,0)), 0.02)

        //     if(this.getComponent(Transform).position!=this._dropDown)
        //         this.getComponent(Transform).position = Vector3.Lerp(this.getComponent(Transform).position, this._dropDown, 0.1)
        // }

        if(this.CurrentState == BlasterState.SELECTED){
            
            if(this.getComponent(Transform).scale != this._selected_scale)
            {
                this.getComponent(Transform).scale = Vector3.Lerp(this.getComponent(Transform).scale, this._selected_scale, 0.1)
            }
            this.getComponent(Transform).position = Vector3.Lerp(this.getComponent(Transform).position, Camera.instance.feetPosition.add(this.offset), 0.1)
            this.getComponent(Transform).rotation = Quaternion.Slerp(this.getComponent(Transform).rotation, Camera.instance.rotation.multiply(Quaternion.Euler(0,90,0)), 0.3)
        }
        else{
            if(this.getComponent(Transform).scale != Vector3.Zero())
            {
                this.getComponent(Transform).scale = Vector3.Lerp(this.getComponent(Transform).scale, Vector3.Zero(), 0.1)
            }
            if(this.getComponent(Transform).position != this._dropDown){
                this.getComponent(Transform).position = Vector3.Lerp(this.getComponent(Transform).position, this._dropDown, 0.1)
            }
        }

        
    }

    // if the player clicks the mouse, the blaster will shoot in the entity's position, which the cursor is directed 
    public shoot(letter): void
    {
        log("shoot")
        // spawn cube in hitPoint position
        PhysicsCast.instance.hitFirst( PhysicsCast.instance.getRayFromCamera(100), (hit)=>
        {   
            if(hit.didHit)
            {
               
                this.moveBoolet(this.boolet(Number(this.Books[this.Books.length-1]?.book_model)), 
               
                this.parabola_path(Camera.instance.feetPosition.add(this.offset), hit.hitPoint, 2, 10), 0)
                
            }
        })
        this.equalize(letter, this.Books[this.Books.length-1].title, this.Books[this.Books.length-1].spawn_key)
        this.RemoveBook()
     
    }
    public log_inventory(){
        if(this.Books.length == 0)
            return
        log('current title: ',this.Books[this.Books.length-1].title )
        if(this.Books.length > 2){
        for(let i = 0; i < this.Books.length-1; i++){
            log('book in inventory: ',i.toString(), this.Books[i].title)
        }}
    }
   
    public letter_equal(spawn_key){
        log("letter_equal")
        this._equalsed_books +=1
        this._UI.UpdateScore((this._equalsed_books*10).toString())
       this.generate_key(true, spawn_key)
    }
    public letter_unequal(spawn_key){
        log("letter_unequal")
        this.generate_key(false, spawn_key)

    }
    private equalize(letter, title, spawn_key){
        letter == title[0] ? this.letter_equal(spawn_key) : this.letter_unequal(spawn_key)

    }

    private select(){
        if(this.CurrentState == BlasterState.SEARCHING && this.Books.length >= 10){
            this.Show()
            return
        }

        let prompt_text = ''
        switch(this.CurrentState){
            case BlasterState.SEARCHING:
                
                prompt_text = 'You haven\'t found any books!\n There are '+(10-this.Books.length).toString() +' books left '
                break;
            case BlasterState.ENDED:
                prompt_text = 'You\'ve already passed the game!'
                break;
        }

        this._popup.showAlert(prompt_text)
    }
    

    private generate_key(equal: boolean, spawn_key: string)
     {

        let key = ""
        for(let i = 0; i < 10; i++){
            let letter = String.fromCharCode(Math.floor(Math.random() * 26) + 65)
            if(Math.random() > 0.5)
                letter = letter.toLowerCase()
            key += letter
        }
        
        // if equal, check count of letters 'g' in key
        
        let count = 0
        for(let i = 0; i < key.length; i++){
            if(key[i] == 'g')

                count++
        }
        if(equal){
            if(count%2 != 0)
                // add letter 'g' to random place in key
                key = key.slice(0, Math.floor(Math.random() * key.length)) + 'g' + key.slice(Math.floor(Math.random() * key.length))
        }
        if(!equal){
            if(count%2 == 0)
                // add letter 'g' to random place in key
                key = key.slice(0, Math.floor(Math.random() * key.length)) + 'g' + key.slice(Math.floor(Math.random() * key.length))
        } 
        this.send_letter(key, spawn_key)
    }
    
    private async send_letter(key: string, spawn_book_id: string){

        let res: any = await ws.request({
            route: 'blaster/check_filled_book',
            payload: { key, spawn_book_id}
        })
        if (res.payload.success) {
            
          

            map_counters['blaster_ammo'].decreaseCounter()
            let {correct_filled} = res.payload
            if(correct_filled){
                this._UI.UpdateScore((Number(correct_filled)*10).toString())
            }
            
        }
        
    }
    public async get_award(){
        let res: any = await ws.request({
            route: 'blaster/get_award',
            payload: {}
        })
        if (res.payload.success) {
        
            let { award } = res.payload
            eventManager.fireEvent(new QuestCreditsUpdated(libraryCardGui.getBalance() + Number(award)))
            
            this._popup.showAlert('You\'ve got '+award+' credits!')
            this._equalsed_books = 0
        }   
        
    }
    // change material of an entity if cursor is directed on it

    private boolet(id:number): Entity
    {
        let boolet = new Entity()
        boolet.addComponent(new Transform({position: Camera.instance.feetPosition.add(new Vector3(0,1,0)), scale: new Vector3(1, 1, 1)}))
        let random = Math.floor(Math.random() * 3)
        if(id == 1)

            boolet.addComponent(designs.models.book3)
        else if(id == 2)
            boolet.addComponent(designs.models.book4)   
        else
            boolet.addComponent(designs.models.book5)
        engine.addEntity(boolet)
        return boolet
    }

    parabola_path(start: Vector3, end: ReadOnlyVector3, height: number, steps: number): Vector3[] {
        let path: Vector3[] = []
        let step = 1 / steps
        for (let i = 0; i <= 1; i += step) {
            let x = start.x + (end.x - start.x) * i
            let y = start.y + (end.y - start.y) * i
            let z = start.z + (end.z - start.z) * i
            let h = height * (1 - 4 * (i - 0.5) * (i - 0.5))
            path.push(new Vector3(x, y + h, z))

        }
        return path
    }
    
    private moveBoolet(boolet: Entity, path:Vector3[], id:number): void
    {
        if(boolet.getComponent(Transform).position != path[id]){

            // rotate randomly
            boolet.addComponentOrReplace(new utils.RotateTransformComponent(boolet.getComponent(Transform).rotation, Quaternion.Euler(360*Math.random(), 360*Math.random(), 360*Math.random()), 1))
            boolet.addComponentOrReplace(new utils.MoveTransformComponent(boolet.getComponent(Transform).position, path[id], 0.1, () => {
                if(id < path.length-1){
                    this.moveBoolet(boolet, path, id+1)
                }
                else{
                    engine.removeEntity(boolet)
                }
            }))
        }
    }

    private CheckOnEnd(){

        if(this._magazine - this.Books.length < 10)
            return


        this.addComponentOrReplace(new utils.Delay(1000,()=>{
        
        this._UI.HideCursor()
        this.Hide()
        this.CurrentState = BlasterState.SEARCHING
        
        let ending_text = ''
        if(this._equalsed_books == 0)
            ending_text = 'You didn\'t hit a single book('
        else if(this._equalsed_books < 4)
            ending_text = 'You managed to organize several books'
        else if(this._equalsed_books < 8)
            ending_text = 'You\'ve managed to organize most of the books!'
        else
            ending_text = 'You\'ve arranged almost all the books!'
        this._popup.showPrompt(ending_text, () => {this.get_award() })
        }))
        
        //this._equalsed_books = 0
    }
    private OnBooksCountChanged(){

        if(this.CurrentState == BlasterState.SELECTED)
        {   
            
            
            this._UI.drawBooksCount(10-this._magazine + this.Books.length , this.Books[this.Books.length-1]?.title)
        }
        
        
        
        this._chestParser.reset_cells()
    }
    private CreateCollider(){
        let blasterStand = new Entity()
        blasterStand.addComponent(designs.models.blaster_stand)
        blasterStand.addComponent(new Transform({position: this.getComponent(Transform).position.add(new Vector3(0,-0.8,0)), scale: new Vector3(0.5, 0.5, 0.5), rotation: Quaternion.Euler(0,-90,0)}))
        engine.addEntity(blasterStand)

        let collider = new Entity()
        collider.addComponent(new BoxShape())
        collider.addComponent(new Material())
        collider.getComponent(Material).transparencyMode = TransparencyMode.ALPHA_TEST
        collider.getComponent(Material).albedoColor = new Color4(0,0,0,0)
        collider.addComponent(new OnPointerDown((e)=>{
            this.select()
        },{
            hoverText: 'Take'
        }))
        collider.addComponent(new Transform({position: blasterStand.getComponent(Transform).position, scale: new Vector3(1,3,3)}))
        this._collider = collider
        engine.addEntity(this._collider)
        

       
    }
    
  
    
} 
let global_blaster: Blaster

observer_collected_spawns_on_init.add((eventData: any) => {
   
    
    global_blaster.removeAllBooks()
    map_counters['blaster_ammo'].setCounter(0)
    let { collected_spawns } = eventData.payload
    
    let array_spawns = Object.keys(collected_spawns)
    
    for (let spawn_key of array_spawns) {
        let spawn = collected_spawns[spawn_key]
        let { type } = spawn
        if (type === 'book') {
            // from Object Spawn open title key
            let { book } = spawn
            let { title } = book
            let { book_model } = book
            map_counters['blaster_ammo'].increaseCounter()
            
            global_blaster.AddBook({ title, book_model, spawn_key } as IBook)
            

        }
    }
}
)

observer_user_state.add((eventData: any) => {

    let { current_game } = eventData.payload.blaster
    let {active, finished, award_collected, correct_filled} = current_game
    global_blaster._UI.UpdateScore((Number(correct_filled)*10).toString())
    if(finished && !award_collected){
        global_blaster.get_award()
    }
    else{
        
        if(active){
            

            global_blaster.Show()
        }
    }
})




observer_collected_spawn.add((eventData: any, eventState) => {
    

    let { spawns } = eventData.payload
    let { success } = eventData.payload
    if(success){
    let array_spawns = Object.keys(spawns)
    for (let spawn_key of array_spawns) {
        let spawn = spawns[spawn_key]
        let { type } = spawn
        if (type === 'book') {
            let { book } = spawn
            let { title } = book
            let { book_model } = book
            map_counters['blaster_ammo'].increaseCounter()
            log('spawn_key', spawn_key)
            global_blaster.AddBook({ title, book_model, spawn_key } as IBook)
            
        }
    }
    
    }
})
