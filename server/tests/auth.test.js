import request  from "supertest";
import app from '../server.js';
import assert from 'assert';

describe("Authentication API",()=>{
    it("should register a test user",async()=>{
        const email=`test${Date.now()}@example.com`;
        const res=await request(app)
        .post("/api/auth/register")
        .send({
            name:"Test User",
            email: email,
            password:"password"
        })
       assert.equal(res.statusCode, 201);
    assert.equal(res.body.name, "Test User");
    assert.equal(res.body.email, email);
    assert.equal(res.body.authProvider, "local");
    assert.ok(res.body.id);
    });
    it("should not register a duplicate email",async()=>{
        const email=`duplicate${Date.now()}@example.com`;

        await request(app)
        .post("/api/auth/register")
        .send({
            name:"Test User",
            email: email,
            password:"password"
        })
        const res=await request(app)
        .post("/api/auth/register")
        .send({
            name:"Test User",
            email: email,
            password:"password"
        })
        assert.equal(res.statusCode, 409);
        assert.equal(res.body.message, "Email already registered");

    })
})
