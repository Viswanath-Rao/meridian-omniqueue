#include <iostream>
#include <queue>
#include <string>
using namespace std;

// Structure for Ticket
struct Ticket {
    int ticketNumber;
    string customerName;
};

// Class for Ticket System
class TicketingSystem {
private:
    queue<Ticket> ticketQueue;
    int nextTicketNumber;

public:
    // Constructor
    TicketingSystem() : nextTicketNumber(1) {}

    // Create Ticket
    void createTicket() {
        string name;
        cout << "Enter customer name: ";
        cin >> name;

        Ticket t = { nextTicketNumber++, name };
        ticketQueue.push(t);

        cout << "Ticket #" << t.ticketNumber 
             << " created for " << t.customerName << endl;
    }

    // Serve Ticket
    void serveTicket() {
        if (ticketQueue.empty()) {
            cout << "No tickets to serve.\n";
            return;
        }

        Ticket t = ticketQueue.front();
        ticketQueue.pop();

        cout << "Serving ticket #" << t.ticketNumber 
             << " for " << t.customerName << endl;
    }

    // Display Queue
    void displayQueue() {
        if (ticketQueue.empty()) {
            cout << "No pending tickets.\n";
            return;
        }

        queue<Ticket> temp = ticketQueue;

        cout << "\nPending Tickets:\n";
        while (!temp.empty()) {
            Ticket t = temp.front();
            temp.pop();

            cout << "Ticket #" << t.ticketNumber 
                 << ": " << t.customerName << endl;
        }
    }
};

// Main Function
int main() {
    TicketingSystem system;
    int choice;

    do {
        cout << "\n===== Ticket Management System =====\n";
        cout << "1. Create Ticket\n";
        cout << "2. Serve Ticket\n";
        cout << "3. Display Queue\n";
        cout << "4. Exit\n";
        cout << "Enter your choice: ";
        cin >> choice;

        switch (choice) {
            case 1:
                system.createTicket();
                break;
            case 2:
                system.serveTicket();
                break;
            case 3:
                system.displayQueue();
                break;
            case 4:
                cout << "Exiting program...\n";
                break;
            default:
                cout << "Invalid choice! Try again.\n";
        }

    } while (choice != 4);

    return 0;
}
